import { Injectable } from '@nestjs/common';
import type { CefrLevel } from '@prisma/client';
import { PrismaService } from './prisma.service';

/**
 * A1/A2 content lives in the generic model (exam_sections); B1/B2 keep
 * reading their own 18 tables. Shared by every consumer that needs to know
 * which track a level's content lives in — training content assembly
 * (ModelltestsService), the exam catalogue (ExamModelltestsService) — so the
 * answer never drifts between them.
 */
export const GENERIC_MODEL_LEVELS: readonly CefrLevel[] = ['A1', 'A2'];

/** One exam_sections row, with its items and options, as a client reads it. */
export interface GenericSectionContent {
  sectionId: string;
  aufgabentyp: string;
  teil: number;
  label: string;
  instruction: string;
  maxPoints: number;
  scoringMode: string;
  material: unknown;
  items: {
    itemNumber: number;
    prompt: string | null;
    solution: unknown;
    options: { key: string; content: string; isCorrect: boolean }[];
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
      bySkill[row.skill].push({
        sectionId: `${row.skill}_${row.teil}`,
        aufgabentyp: row.aufgabentyp,
        teil: row.teil,
        label: row.label,
        instruction: row.instruction,
        maxPoints: row.max_points,
        scoringMode: row.scoring_mode,
        material: row.material,
        items: row.items.map((item) => ({
          itemNumber: item.item_number,
          prompt: item.prompt,
          solution: item.solution,
          options: item.options.map((option) => ({
            key: option.key,
            content: option.content,
            isCorrect: option.is_correct,
          })),
        })),
      });
    }
    return bySkill;
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
