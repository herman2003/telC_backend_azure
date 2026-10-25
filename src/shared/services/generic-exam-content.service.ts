import { Injectable } from '@nestjs/common';
import type { CefrLevel, Prisma, Skill } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { optionalCorrection } from '../training-correction';

type ExamSectionRow = Prisma.ExamSectionGetPayload<{
  include: { items: { include: { options: true } } };
}>;

/**
 * A1/A2 content lives in the generic model (exam_sections); B1/B2 keep
 * reading their own 18 tables. Shared by every consumer that needs to know
 * which track a level's content lives in — training content assembly
 * (ModelltestsService), the exam catalogue (ExamModelltestsService) — so the
 * answer never drifts between them.
 */
export const GENERIC_MODEL_LEVELS: readonly CefrLevel[] = ['A1', 'A2'];

/** Option / item pictures stored in material (no image column on the tables). */
type MaterialImageMaps = {
  optionImages?: Record<string, Record<string, string | null>>;
  itemImages?: Record<string, string | null>;
};

/** One exam_sections row, with its items and options, as a client reads it. */
export interface GenericSectionContent {
  /** The `exam_sections` row id. For a Hören Teil it is also the `audioId`
   *  the candidate asks to play. */
  id: string;
  sectionId: string;
  aufgabentyp: string;
  teil: number;
  label: string;
  instruction: string;
  maxPoints: number;
  scoringMode: string;
  /** Globally unique content version — training submit echoes it back. */
  contentRevision: string;
  material: unknown;
  items: {
    itemNumber: number;
    prompt: string | null;
    solution: unknown;
    /** Training Corrigé when authored. */
    correction?: Record<string, unknown>;
    /** From material.itemImages when the Teil has per-item pictures. */
    imageUrl?: string | null;
    options: {
      key: string;
      content: string;
      isCorrect: boolean;
      /** From material.optionImages when the Teil has option pictures. */
      imageUrl?: string | null;
    }[];
  }[];
}

/**
 * Reads and gates a generic-model Modelltest's content. The only place this
 * logic lives — `docs/architecture/multi-level.md` Part 7 Principle 1 says a
 * level may be branched on only in the layer that assembles content, never
 * duplicated into every consumer.
 */
@Injectable()
export class GenericExamContentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * A generic-model Modelltest's content, grouped by skill. One list per
   * skill (empty for a skill the level doesn't offer, e.g. A2's
   * Sprachbausteine) — not B1's single-object-per-written-skill shape,
   * since nothing yet consumes a generic-model level's content and there
   * is no B1 convention to match.
   */
  async sectionsFor(
    modelltestId: string,
  ): Promise<Record<string, GenericSectionContent[]>> {
    const rows = await this.prisma.examSection.findMany({
      where: { modelltest_id: modelltestId },
      orderBy: [{ skill: 'asc' }, { teil: 'asc' }],
      include: {
        items: {
          orderBy: { item_number: 'asc' },
          include: { options: { orderBy: { sort_order: 'asc' } } },
        },
      },
    });

    const bySkill: Record<string, GenericSectionContent[]> = {
      HOEREN: [],
      LESEN: [],
      SPRACHBAUSTEINE: [],
      SCHREIBEN: [],
      SPRECHEN: [],
    };
    for (const row of rows) {
      bySkill[row.skill].push(this.toSectionContent(row));
    }
    return bySkill;
  }

  /**
   * One `(modelltest, skill, teil)` section, with its items' solutions --
   * for scoring (`ExamScoringService`), never served to a client as-is.
   * Null when that Teil has no content yet.
   */
  async sectionFor(
    modelltestId: string,
    skill: Skill,
    teil: number,
  ): Promise<GenericSectionContent | null> {
    const row = await this.prisma.examSection.findFirst({
      where: { modelltest_id: modelltestId, skill, teil },
      include: {
        items: {
          orderBy: { item_number: 'asc' },
          include: { options: { orderBy: { sort_order: 'asc' } } },
        },
      },
    });
    return row ? this.toSectionContent(row) : null;
  }

  private toSectionContent(row: ExamSectionRow): GenericSectionContent {
    const maps = (row.material ?? {}) as MaterialImageMaps;
    const optionImages = maps.optionImages ?? {};
    const itemImages = maps.itemImages ?? {};

    return {
      id: row.id,
      sectionId: `${row.skill}_${row.teil}`,
      aufgabentyp: row.aufgabentyp,
      teil: row.teil,
      label: row.label,
      instruction: row.instruction,
      maxPoints: row.max_points,
      scoringMode: row.scoring_mode,
      contentRevision: row.content_revision,
      material: row.material,
      items: row.items.map((item) => {
        const n = String(item.item_number);
        const byKey = optionImages[n] ?? {};
        const correction = optionalCorrection(item.correction);
        return {
          itemNumber: item.item_number,
          prompt: item.prompt,
          solution: item.solution,
          ...(correction ? { correction } : {}),
          imageUrl: itemImages[n] ?? null,
          options: item.options.map((option) => ({
            key: option.key,
            content: option.content,
            isCorrect: option.is_correct,
            imageUrl: byKey[option.key] ?? null,
          })),
        };
      }),
    };
  }

  /**
   * A generic-model Modelltest is exam-ready when it has a section for
   * every `(skill, teil)` the level's `exam_section_weights` rows name —
   * the generic-model equivalent of `COMPLETE_EXAM_MODELLTEST_WHERE`'s
   * fixed 12-relation check for B1/B2. A level with no weight rows yet
   * (seeded data missing) is never complete, not vacuously complete.
   */
  async isComplete(level: CefrLevel, modelltestId: string): Promise<boolean> {
    const [weights, sections] = await Promise.all([
      this.prisma.examSectionWeight.findMany({
        where: { level },
        select: { skill: true, teil: true },
      }),
      this.prisma.examSection.findMany({
        where: { modelltest_id: modelltestId },
        select: { skill: true, teil: true },
      }),
    ]);
    if (weights.length === 0) return false;

    const have = new Set(sections.map((s) => `${s.skill}_${s.teil}`));
    return weights.every((w) => have.has(`${w.skill}_${w.teil}`));
  }
}
