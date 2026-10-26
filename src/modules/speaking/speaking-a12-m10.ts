/**
 * telc A1 / A2 Mündlicher Ausdruck — official M10 task bands (half-points),
 * not the B1 A–D Schriftlicher/Mündlicher grid.
 *
 * Sources: telc Deutsch A1 Übungstest 1 (M10); telc Deutsch A2 Übungstest 1.
 * Total oral = 15 (Teil 1 = 3, Teil 2 = 6, Teil 3 = 6).
 */

import type { CefrLevel } from '@prisma/client';
import { assertScoredTeil, type ScoredTeil } from './speaking-telc-rating';

export type A12Band = 'FULL' | 'HALF' | 'ZERO' | 'NOT_ASSESSED';

export type A12CriterionDef = {
  key: string;
  /** Full / half / zero point values from the official form. */
  points: [number, number, number];
};

const A1_TEIL1: A12CriterionDef[] = [
  { key: 'vorstellen', points: [1, 0.5, 0] },
  { key: 'buchstabieren', points: [1, 0.5, 0] },
  { key: 'zahlen', points: [1, 0.5, 0] },
];

const A1_TEIL2: A12CriterionDef[] = [
  { key: 'frage1', points: [2, 1, 0] },
  { key: 'antwort1', points: [1, 0.5, 0] },
  { key: 'frage2', points: [2, 1, 0] },
  { key: 'antwort2', points: [1, 0.5, 0] },
];

const A1_TEIL3: A12CriterionDef[] = [
  { key: 'bitte1', points: [2, 1, 0] },
  { key: 'reaktion1', points: [1, 0.5, 0] },
  { key: 'bitte2', points: [2, 1, 0] },
  { key: 'reaktion2', points: [1, 0.5, 0] },
];

const A2_TEIL1: A12CriterionDef[] = [
  { key: 'vorstellen', points: [1, 0.5, 0] },
  { key: 'zusatzfragen', points: [2, 1, 0] },
];

const A2_TEIL2: A12CriterionDef[] = [
  { key: 'frage1', points: [1, 0.5, 0] },
  { key: 'antwort1', points: [1, 0.5, 0] },
  { key: 'frage2', points: [1, 0.5, 0] },
  { key: 'antwort2', points: [1, 0.5, 0] },
  { key: 'frage3', points: [1, 0.5, 0] },
  { key: 'antwort3', points: [1, 0.5, 0] },
];

const A2_TEIL3: A12CriterionDef[] = [
  { key: 'erfuellungDerAufgabenstellung', points: [3, 1.5, 0] },
  { key: 'sprachlicheRealisierung', points: [3, 1.5, 0] },
];

const BY_LEVEL: Record<'A1' | 'A2', Record<ScoredTeil, A12CriterionDef[]>> = {
  A1: { 1: A1_TEIL1, 2: A1_TEIL2, 3: A1_TEIL3 },
  A2: { 1: A2_TEIL1, 2: A2_TEIL2, 3: A2_TEIL3 },
};

export function isA12SpeakingLevel(level: CefrLevel): level is 'A1' | 'A2' {
  return level === 'A1' || level === 'A2';
}

export function isA12Band(value: unknown): value is A12Band {
  return (
    value === 'FULL' ||
    value === 'HALF' ||
    value === 'ZERO' ||
    value === 'NOT_ASSESSED'
  );
}

export function a12CriteriaFor(
  level: 'A1' | 'A2',
  teilNumber: number,
): A12CriterionDef[] {
  const teil = assertScoredTeil(teilNumber);
  return BY_LEVEL[level][teil];
}

export function a12MaxPoints(level: 'A1' | 'A2', teilNumber: number): number {
  return a12CriteriaFor(level, teilNumber).reduce(
    (sum, c) => sum + c.points[0],
    0,
  );
}

function bandPoints(
  band: A12Band,
  table: [number, number, number],
): number | null {
  if (band === 'NOT_ASSESSED') return null;
  if (band === 'FULL') return table[0];
  if (band === 'HALF') return table[1];
  return table[2];
}

export type A12CriterionResult = {
  key: string;
  band: A12Band;
  points: number | null;
  maxPoints: number;
};

export type A12SpeakingRating = {
  scheme: 'A1_A2_M10';
  level: 'A1' | 'A2';
  teilNumber: ScoredTeil;
  criteria: A12CriterionResult[];
  /** Sum of assessed criteria only. */
  points: number;
  maxPoints: number;
  /** Max of criteria that were assessed (excludes NOT_ASSESSED). */
  assessedMaxPoints: number;
  /** 0–100 over assessedMaxPoints; 0 if nothing assessed. */
  scorePercent: number;
};

export function buildA12SpeakingRating(
  level: 'A1' | 'A2',
  teilNumber: number,
  bands: Record<string, A12Band>,
): A12SpeakingRating {
  const teil = assertScoredTeil(teilNumber);
  const defs = a12CriteriaFor(level, teil);
  const criteria: A12CriterionResult[] = defs.map((def) => {
    const band = bands[def.key] ?? 'NOT_ASSESSED';
    if (!isA12Band(band)) {
      throw new Error(`Invalid A12 band for ${def.key}`);
    }
    return {
      key: def.key,
      band,
      points: bandPoints(band, def.points),
      maxPoints: def.points[0],
    };
  });

  let points = 0;
  let assessedMax = 0;
  for (const row of criteria) {
    if (row.points == null) continue;
    points += row.points;
    assessedMax += row.maxPoints;
  }
  const maxPoints = a12MaxPoints(level, teil);
  const scorePercent =
    assessedMax <= 0 ? 0 : Math.round((points / assessedMax) * 100);

  return {
    scheme: 'A1_A2_M10',
    level,
    teilNumber: teil,
    criteria,
    points,
    maxPoints,
    assessedMaxPoints: assessedMax,
    scorePercent,
  };
}

export function a12TeilContext(level: 'A1' | 'A2', teilNumber: number): string {
  const a1: Record<number, string> = {
    1: 'Teil 1 — Sich vorstellen: introduce yourself; spelling (Buchstabieren); numbers (Zahlen). Score each element FULL/HALF/ZERO or NOT_ASSESSED if absent from the transcript.',
    2: 'Teil 2 — Um Informationen bitten und Informationen geben: two questions (2 pts each) and two answers (1 pt each).',
    3: 'Teil 3 — Bitten formulieren und darauf reagieren: two requests (2 pts) and two reactions (1 pt).',
  };
  const a2: Record<number, string> = {
    1: 'Teil 1 — Sich vorstellen: introduction (1 pt) and Zusatzfragen (2 pts).',
    2: 'Teil 2 — Ein Alltagsgespräch führen: three questions and three answers (1 pt each).',
    3: 'Teil 3 — Etwas aushandeln: Erfüllung der Aufgabenstellung (3 / 1.5 / 0) and Sprachliche Realisierung (3 / 1.5 / 0), scored separately.',
  };
  const map = level === 'A1' ? a1 : a2;
  return map[teilNumber] ?? map[1];
}
