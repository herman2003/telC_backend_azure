import { WritingCorrectionService } from './writing-correction.service';
import {
  buildTelcSchreibenRating,
  scoreFromTelcPoints,
} from './writing-telc-rating';

describe('WritingCorrectionService.parseWritingResponse', () => {
  const service = Object.create(
    WritingCorrectionService.prototype,
  ) as WritingCorrectionService;

  it('parses telc letters and ignores a model numeric score', () => {
    const parsed = service.parseWritingResponse(`{
      "taskFulfilment": "A",
      "communicativeDesign": "B",
      "formalAccuracy": "C",
      "points_addressed": 4,
      "score": 99,
      "feedback": "Gut.",
      "corrected_text": "Hallo,",
      "corrections": []
    }`);

    expect(parsed.criteria).toEqual({
      taskFulfilment: 'A',
      communicativeDesign: 'B',
      formalAccuracy: 'C',
    });
    expect(parsed.pointsAddressed).toBe(4);

    const rating = buildTelcSchreibenRating(parsed.criteria, 4, 4);
    expect(rating.points).toBe((5 + 3 + 1) * 3);
    expect(scoreFromTelcPoints(rating.points)).toBe(
      Math.round((((5 + 3 + 1) * 3) / 45) * 100),
    );
  });

  it('rejects missing letter grades', () => {
    expect(() =>
      service.parseWritingResponse(`{
        "score": 80,
        "feedback": "x",
        "corrected_text": "y",
        "corrections": []
      }`),
    ).toThrow(/telc letter/);
  });

  it('applies D-kill when recomputing score', () => {
    const parsed = service.parseWritingResponse(`{
      "taskFulfilment": "D",
      "communicativeDesign": "A",
      "formalAccuracy": "A",
      "points_addressed": 0,
      "feedback": "Zu wenig Inhalt.",
      "corrected_text": "Hi",
      "corrections": []
    }`);
    const rating = buildTelcSchreibenRating(
      parsed.criteria,
      parsed.pointsAddressed,
      4,
    );
    expect(rating.points).toBe(0);
    expect(scoreFromTelcPoints(rating.points)).toBe(0);
  });
});
