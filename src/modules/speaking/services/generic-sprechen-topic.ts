import type { GenericSectionContent } from '../../../shared/services/generic-exam-content.service';
import type { ExaminerTopic } from '../live/examiner-prompt.service';

/**
 * Maps an A1/A2 generic SPRECHEN section into Elena's ExaminerTopic shape
 * (title / description / points), so live-token can feed THEMA_JSON the same
 * way B1 `speaking_exercises` do.
 *
 * Material shapes differ by Aufgabentyp (prompts, rounds+cards, topic+cards,
 * participantCards). Unknown fields are ignored; empty points are allowed.
 */
export function examinerTopicFromGenericSection(
  section: Pick<
    GenericSectionContent,
    'label' | 'instruction' | 'aufgabentyp' | 'material'
  >,
): ExaminerTopic {
  const material = asRecord(section.material);
  const topic =
    stringField(material, 'topic') ??
    firstRoundTopic(material) ??
    section.label ??
    section.aufgabentyp;

  return {
    title: topic,
    description: section.instruction,
    points: pointsFromMaterial(material),
  };
}

function pointsFromMaterial(material: Record<string, unknown>): string[] {
  const points: string[] = [];

  const goal = stringField(material, 'goal');
  if (goal) points.push(goal);

  pushStrings(points, material.prompts);
  pushStrings(points, material.examinerPrompts);

  if (Array.isArray(material.cards)) {
    for (const card of material.cards) {
      const text = cardText(card);
      if (text) points.push(text);
    }
  }

  if (Array.isArray(material.rounds)) {
    for (const round of material.rounds) {
      const r = asRecord(round);
      const roundTopic = stringField(r, 'topic');
      if (roundTopic) points.push(`Thema: ${roundTopic}`);
      if (Array.isArray(r.cards)) {
        for (const card of r.cards) {
          const text = cardText(card);
          if (text) points.push(text);
        }
      }
    }
  }

  const participantCards = asRecord(material.participantCards);
  for (const [who, cards] of Object.entries(participantCards)) {
    if (!Array.isArray(cards)) continue;
    const texts = cards.filter((c): c is string => typeof c === 'string');
    if (texts.length > 0) points.push(`${who}: ${texts.join(', ')}`);
  }

  return points;
}

function firstRoundTopic(material: Record<string, unknown>): string | null {
  if (!Array.isArray(material.rounds) || material.rounds.length === 0) {
    return null;
  }
  return stringField(asRecord(material.rounds[0]), 'topic');
}

function cardText(card: unknown): string | null {
  const r = asRecord(card);
  return stringField(r, 'text') ?? stringField(r, 'key');
}

function pushStrings(into: string[], value: unknown): void {
  if (!Array.isArray(value)) return;
  for (const item of value) {
    if (typeof item === 'string' && item.trim()) into.push(item);
  }
}

function stringField(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}
