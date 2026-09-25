/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { ExamResultsController } from '../src/modules/centers/exam-results.controller';
import { CenterAuthGuard } from '../src/modules/centers/guards/center-auth.guard';

/**
 * What a manager reads and writes about results.
 *
 * The controller decides nothing. What is worth pinning here is that the
 * center comes from the token on every route — a results table is the one
 * place where reading another school's data would be worst.
 */
describe('ExamResultsController', () => {
  const user = { centerId: 'center-1', centerUserId: 'owner-1' } as never;

  let results: any;
  let grading: any;
  let release: any;
  let controller: ExamResultsController;

  beforeEach(() => {
    results = {
      forSession: jest.fn().mockResolvedValue({ candidates: [] }),
      forAttempt: jest.fn().mockResolvedValue({ outcome: 'PASSED' }),
    };
    grading = { recordMark: jest.fn().mockResolvedValue({ points: 40 }) };
    release = {
      releaseSession: jest.fn().mockResolvedValue({ released: 3 }),
      releaseAttempt: jest.fn().mockResolvedValue({ released: 1 }),
    };
    controller = new ExamResultsController(results, grading, release);
  });

  it('is behind the center guard', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      ExamResultsController,
    ) as unknown[];

    expect(guards).toContain(CenterAuthGuard);
  });

  it('reads a sitting scoped to the signed center', async () => {
    await controller.sessionResults(user, 'session-1');

    expect(results.forSession).toHaveBeenCalledWith('center-1', 'session-1');
  });

  it('reads one candidate scoped to the signed center', async () => {
    // Without the center, an attempt id from anywhere would return a result.
    // Of everything in this feature, another school's marks are the worst
    // thing to hand out.
    await controller.attemptResult(user, 'attempt-1');

    expect(results.forAttempt).toHaveBeenCalledWith('attempt-1', 'center-1');
  });

  it('releases a sitting as the signed center', async () => {
    await controller.releaseSession(user, 'session-1');

    expect(release.releaseSession).toHaveBeenCalledWith(user, 'session-1');
  });

  it('records a mark as the signed manager', async () => {
    await controller.recordMark(user, 'attempt-1', {
      skill: 'SCHREIBEN',
      teil: 1,
      points: 40,
    });

    expect(grading.recordMark).toHaveBeenCalledWith(user, 'attempt-1', {
      skill: 'SCHREIBEN',
      teil: 1,
      points: 40,
    });
  });
});
