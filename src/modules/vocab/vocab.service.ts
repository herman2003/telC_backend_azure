import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { TrainingModelltestAccessService } from '../../shared/services/training-modelltest-access.service';
import { getSevenDayPeriod } from '../modelltests/seven-day-period';
import type {
  UpdateVocabProgressDto,
  VocabConjugationDto,
  VocabEntryCardDto,
  VocabOfTheWeekDto,
  VocabProgressSummaryDto,
  VocabSenseDto,
} from './dto/vocab.dto';
import {
  localizeVocabSense,
  parseVocabLang,
  type VocabLang,
} from './vocab-locale';

type EntryRow = {
  id: string;
  lemma: string;
  article: string;
  pos: string;
  gender: string | null;
  plural: string | null;
  cefr_level: string | null;
  auxiliary: string | null;
  separable: boolean | null;
  partizip_ii: string | null;
  comparative: string | null;
  superlative: string | null;
  governs_case: string | null;
  senses: Array<{
    id: string;
    sort_order: number;
    meaning_fr: string;
    meaning_en: string | null;
    example_de: string;
    example_fr: string | null;
    example_en: string | null;
    note_fr: string | null;
    note_en: string | null;
  }>;
  verb_forms: Array<{ tense: string; person: string; form_de: string }>;
};

@Injectable()
export class VocabService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trainingAccess: TrainingModelltestAccessService,
  ) {}

  async getOfTheWeek(
    studentId: string,
    now: Date = new Date(),
    opts: { isGuest?: boolean; lang?: string | null } = {},
  ): Promise<VocabOfTheWeekDto> {
    const lang = parseVocabLang(opts.lang);
    const weeklyNumber = await this.trainingAccess.weeklyModelltestNumber(
      studentId,
      now,
      { isGuest: opts.isGuest === true },
    );
    const mt = await this.prisma.modelltest.findUnique({
      where: { number: weeklyNumber },
    });
    if (!mt) {
      throw new NotFoundException('VOCAB_WEEKLY_MT_NOT_FOUND');
    }

    const period = getSevenDayPeriod(now);
    const occ = await this.prisma.vocabOccurrence.findMany({
      where: { modelltest_id: mt.id, in_weekly_pack: true },
      select: { vocab_entry_id: true },
    });
    const entryIds = [...new Set(occ.map((o) => o.vocab_entry_id))];
    const entries = entryIds.length
      ? await this.prisma.vocabEntry.findMany({
          where: { id: { in: entryIds } },
          include: {
            senses: { orderBy: { sort_order: 'asc' } },
            verb_forms: true,
          },
        })
      : [];

    const progressMap = await this.loadProgressMap(
      studentId,
      entryIds,
      opts.isGuest === true,
    );

    const cards = entries.map((e) =>
      this.toCard(e as EntryRow, progressMap.get(e.id) ?? null, lang),
    );

    return {
      lang,
      modelltestNumber: mt.number,
      title: mt.title,
      period: {
        start: period.periodStart.toISOString(),
        end: period.periodEnd.toISOString(),
      },
      nouns: cards.filter((c) => c.pos === 'noun'),
      verbs: cards.filter((c) => c.pos === 'verb'),
      adjectives: cards.filter((c) => c.pos === 'adj'),
      adverbs: cards.filter((c) => c.pos === 'adv'),
      prepositions: cards.filter((c) => c.pos === 'prep'),
    };
  }

  async getEntry(
    studentId: string,
    entryId: string,
    opts: { isGuest?: boolean; lang?: string | null } = {},
  ): Promise<VocabEntryCardDto> {
    const lang = parseVocabLang(opts.lang);
    const entry = await this.prisma.vocabEntry.findUnique({
      where: { id: entryId },
      include: {
        senses: { orderBy: { sort_order: 'asc' } },
        verb_forms: true,
      },
    });
    if (!entry) {
      throw new NotFoundException('VOCAB_ENTRY_NOT_FOUND');
    }
    const progressMap = await this.loadProgressMap(
      studentId,
      [entryId],
      opts.isGuest === true,
    );
    return this.toCard(
      entry as EntryRow,
      progressMap.get(entryId) ?? null,
      lang,
    );
  }

  async search(
    q: string,
    opts: { pos?: string; limit?: number; lang?: string | null } = {},
  ): Promise<VocabEntryCardDto[]> {
    const lang = parseVocabLang(opts.lang);
    const query = q.trim();
    if (!query) {
      throw new BadRequestException('VOCAB_SEARCH_QUERY_REQUIRED');
    }
    const limit = Math.min(50, Math.max(1, opts.limit ?? 20));
    const rows = await this.prisma.vocabEntry.findMany({
      where: {
        lemma: { contains: query, mode: 'insensitive' },
        ...(opts.pos ? { pos: opts.pos } : {}),
      },
      take: limit,
      orderBy: [{ lemma: 'asc' }],
      include: {
        senses: { orderBy: { sort_order: 'asc' }, take: 3 },
        verb_forms: true,
      },
    });
    return rows.map((e) => this.toCard(e as EntryRow, null, lang));
  }

  async updateProgress(
    studentId: string,
    entryId: string,
    dto: UpdateVocabProgressDto,
    opts: { isGuest?: boolean } = {},
  ): Promise<{ status: string }> {
    if (opts.isGuest === true) {
      return { status: dto.status };
    }
    const entry = await this.prisma.vocabEntry.findUnique({
      where: { id: entryId },
      select: { id: true },
    });
    if (!entry) {
      throw new NotFoundException('VOCAB_ENTRY_NOT_FOUND');
    }
    await this.prisma.vocabProgress.upsert({
      where: {
        student_id_vocab_entry_id: {
          student_id: studentId,
          vocab_entry_id: entryId,
        },
      },
      create: {
        student_id: studentId,
        vocab_entry_id: entryId,
        status: dto.status,
      },
      update: { status: dto.status },
    });
    return { status: dto.status };
  }

  async getMyProgress(
    studentId: string,
    opts: { isGuest?: boolean } = {},
  ): Promise<VocabProgressSummaryDto> {
    if (opts.isGuest === true) {
      return { learningCount: 0, knownCount: 0 };
    }
    const [learningCount, knownCount] = await Promise.all([
      this.prisma.vocabProgress.count({
        where: { student_id: studentId, status: 'learning' },
      }),
      this.prisma.vocabProgress.count({
        where: { student_id: studentId, status: 'known' },
      }),
    ]);
    return { learningCount, knownCount };
  }

  private async loadProgressMap(
    studentId: string,
    entryIds: string[],
    isGuest: boolean,
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (isGuest || entryIds.length === 0) return map;
    const rows = await this.prisma.vocabProgress.findMany({
      where: {
        student_id: studentId,
        vocab_entry_id: { in: entryIds },
      },
      select: { vocab_entry_id: true, status: true },
    });
    for (const r of rows) {
      map.set(r.vocab_entry_id, r.status);
    }
    return map;
  }

  private toCard(
    entry: EntryRow,
    progressStatus: string | null,
    lang: VocabLang,
  ): VocabEntryCardDto {
    const senses: VocabSenseDto[] = entry.senses.map((s) => {
      const loc = localizeVocabSense(s, lang);
      return {
        id: s.id,
        sortOrder: s.sort_order,
        meaning: loc.meaning,
        exampleGloss: loc.exampleGloss,
        note: loc.note,
        meaningFr: s.meaning_fr,
        meaningEn: s.meaning_en,
        exampleDe: s.example_de,
        exampleFr: s.example_fr,
        exampleEn: s.example_en,
        noteFr: s.note_fr,
        noteEn: s.note_en,
      };
    });

    let conjugation: VocabConjugationDto | null = null;
    if (entry.pos === 'verb' && entry.verb_forms.length > 0) {
      conjugation = {};
      for (const f of entry.verb_forms) {
        const tense = f.tense as keyof VocabConjugationDto;
        if (!conjugation[tense]) conjugation[tense] = {};
        conjugation[tense][f.person] = f.form_de;
      }
    }

    return {
      lang,
      id: entry.id,
      lemma: entry.lemma,
      pos: entry.pos,
      article: entry.article || null,
      gender: entry.gender,
      plural: entry.plural,
      cefrLevel: entry.cefr_level,
      auxiliary: entry.auxiliary,
      separable: entry.separable,
      partizipIi: entry.partizip_ii,
      comparative: entry.comparative,
      superlative: entry.superlative,
      governsCase: entry.governs_case,
      senses,
      conjugation,
      progressStatus,
    };
  }
}
