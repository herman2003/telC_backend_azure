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
        1,
      ),
    ).toThrow('EVALUATION_PARSE_FAILED');
  });
});

describe('EvaluationService Teil 3 context', () => {
  it('prompt describes Gemeinsam etwas planen, not debate', () => {
    const service = Object.create(
      EvaluationService.prototype,
    ) as EvaluationService;
    type PromptBuilder = {
      buildPrompt: (teil: number, transcript: string) => string;
    };
    const prompt = (service as unknown as PromptBuilder).buildPrompt(
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
