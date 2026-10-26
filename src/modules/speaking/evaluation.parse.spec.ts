import type { CefrLevel } from '@prisma/client';
import { EvaluationService } from './services/evaluation.service';

describe('EvaluationService.parseResponse (M10)', () => {
  const service = Object.create(
    EvaluationService.prototype,
  ) as EvaluationService;
  // parseResponse logs on failure; stub Nest Logger for Object.create tests.
  (
    service as unknown as { logger: { error: jest.Mock; debug: jest.Mock } }
  ).logger = { error: jest.fn(), debug: jest.fn() };

  it('parses letters, ignores numeric model scores, computes T1 /15', () => {
    const parsed = service.parseResponse(
      `{
        "expression": "A",
        "taskFulfilment": "A",
        "formalAccuracy": "A",
        "pronunciation": "A",
        "overall_score": 12,
        "evaluation_text": "Hallo! Super.",
        "strengths": "Klar.",
        "areas_for_improvement": "Grammatik.",
        "corrections": []
      }`,
      'B1',
      1,
    );

    expect(parsed.telcRating).toEqual({
      expression: 'A',
      taskFulfilment: 'A',
      formalAccuracy: 'A',
      pronunciation: 'A',
      points: 15,
      maxPoints: 15,
      teilNumber: 1,
    });
    expect(parsed.scores.overall).toBe(100);
  });

  it('computes T2 points /30 and derives legacy score mirrors', () => {
    const parsed = service.parseResponse(
      `{
        "expression": "B",
        "taskFulfilment": "A",
        "formalAccuracy": "C",
        "pronunciation": "B",
        "evaluation_text": "Hallo!",
        "corrections": []
      }`,
      'B1',
      2,
    );

    expect(parsed.telcRating?.points).toBe(6 + 8 + 2 + 4);
    expect(parsed.telcRating?.maxPoints).toBe(30);
    expect(parsed.scores.overall).toBe(
      Math.round(((6 + 8 + 2 + 4) / 30) * 100),
    );
    expect(parsed.scores.vocabulary).toBe(Math.round((6 / 8) * 100));
    expect(parsed.scores.coherence).toBe(100);
    expect(parsed.scores.grammar).toBe(Math.round((2 / 8) * 100));
  });

  it('rejects missing letter grades', () => {
    expect(() =>
      service.parseResponse(
        `{
          "grammar_score": 80,
          "vocabulary_score": 80,
          "coherence_score": 80,
          "overall_score": 80,
          "evaluation_text": "Hallo!",
          "corrections": []
        }`,
        'B1',
        1,
      ),
    ).toThrow('EVALUATION_PARSE_FAILED');
  });
});

describe('the prompt names the level it is rating', () => {
  type PromptBuilder = {
    buildPrompt: (level: CefrLevel, teil: number, transcript: string) => string;
  };
  const promptFor = (level: CefrLevel, teil: number) => {
    const service = Object.create(
      EvaluationService.prototype,
    ) as EvaluationService;
    return (service as unknown as PromptBuilder).buildPrompt(
      level,
      teil,
      'Ein Transkript.',
    );
  };

  /**
   * B1 Teil 1 is Einander kennenlernen, worth 15. At B2 that task is the
   * unscored introduction and Teil 1 is Ueber Erfahrungen sprechen, worth 25.
   * A prompt that names B1 and B1's Teile therefore rates a B2 candidate
   * against the wrong task and the wrong maximum, and returns fluent German
   * feedback about something they were never asked to do.
   */
  it('rates B2 Teil 1 as Ueber Erfahrungen sprechen, out of 25', () => {
    const prompt = promptFor('B2', 1);

    expect(prompt).toContain('telc Deutsch B2');
    expect(prompt).not.toContain('telc Deutsch B1');
    expect(prompt).toContain('Erfahrungen');
    expect(prompt).not.toContain('Einander kennenlernen');
    expect(prompt).toContain('max 25');
  });

  it('rates B2 Teil 2 as a Diskussion, not as a topic talk', () => {
    const prompt = promptFor('B2', 2);

    expect(prompt).toContain('Diskussion');
    expect(prompt).toContain('max 25');
  });

  it('still names B1 and its Teile at B1', () => {
    const prompt = promptFor('B1', 1);

    expect(prompt).toContain('telc Deutsch B1');
    expect(prompt).toContain('Einander kennenlernen');
    expect(prompt).toContain('max 15');
  });
});

describe('EvaluationService Teil 3 context', () => {
  it('prompt describes Gemeinsam etwas planen, not debate', () => {
    const service = Object.create(
      EvaluationService.prototype,
    ) as EvaluationService;
    type PromptBuilder = {
      buildPrompt: (
        level: CefrLevel,
        teil: number,
        transcript: string,
      ) => string;
    };
    const prompt = (service as unknown as PromptBuilder).buildPrompt(
      'B1',
      3,
      'Lass uns am Samstag treffen.',
    );
    expect(prompt).toContain('Gemeinsam etwas planen');
    expect(prompt).toContain('NOT a debate');
    expect(prompt).not.toContain('take a position');
    expect(prompt).toContain('expression');
    expect(prompt).toContain('pronunciation');
  });
});

describe('A1/A2 M10 practice evaluation', () => {
  type A12Surface = {
    buildA12Prompt: (
      level: 'A1' | 'A2',
      teil: number,
      transcript: string,
    ) => string;
    parseA12Response: (
      response: string,
      level: 'A1' | 'A2',
      teil: number,
    ) => ReturnType<EvaluationService['parseA12Response']>;
  };

  const service = () =>
    Object.create(EvaluationService.prototype) as EvaluationService &
      A12Surface;

  it('A2 prompt uses half-point bands, not B1 letters', () => {
    const prompt = service().buildA12Prompt('A2', 3, 'Lass uns wandern.');
    expect(prompt).toContain('telc Deutsch A2');
    expect(prompt).toContain('Etwas aushandeln');
    expect(prompt).toContain('FULL');
    expect(prompt).toContain('NOT_ASSESSED');
    expect(prompt).not.toContain('"expression"');
    expect(prompt).not.toContain('telc Deutsch B1');
  });

  it('parses A1 Teil 1 bands into practice points', () => {
    const result = service().parseA12Response(
      JSON.stringify({
        criteria: {
          vorstellen: 'FULL',
          buchstabieren: 'HALF',
          zahlen: 'NOT_ASSESSED',
        },
        evaluation_text: 'Hallo! Gute Vorstellung.',
        strengths: 'Klar.',
        areas_for_improvement: 'Zahlen üben.',
        corrections: [],
      }),
      'A1',
      1,
    );
    expect(result.scores.overall).toBe(75);
    expect(result.telcRating?.points).toBe(1.5);
    expect(result.telcRating?.maxPoints).toBe(3);
    expect(result.a12M10).toEqual(
      expect.objectContaining({ scheme: 'A1_A2_M10', level: 'A1' }),
    );
  });
});
