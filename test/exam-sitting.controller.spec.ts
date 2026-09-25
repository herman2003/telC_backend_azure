/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { ExamSittingController } from '../src/modules/exams/exam-sitting.controller';
import { JwtAuthGuard } from '../src/shared/guards/jwt-auth.guard';
import { StudentSubscriptionGuard } from '../src/shared/guards/student-subscription.guard';

/**
 * The routes a candidate's app calls.
 *
 * The controller decides almost nothing — that is the point. What is worth
 * asserting here is that the student comes from the token and never from the
 * path, and that the guards are the ones this feature needs rather than the
 * ones every other learning route has.
 */
describe('ExamSittingController', () => {
  const student = { studentId: 'student-1', deviceId: 'device-1' } as never;

  let sitting: any;
  let content: any;
  let scoring: any;
  let audio: any;
  let release: any;
  let speaking: any;
  let controller: ExamSittingController;

  beforeEach(() => {
    sitting = {
      mySessions: jest.fn().mockResolvedValue([]),
      start: jest.fn().mockResolvedValue({ id: 'attempt-1' }),
      getAttempt: jest.fn().mockResolvedValue({ id: 'attempt-1' }),
      startBlock: jest.fn().mockResolvedValue({ block: 'HOEREN' }),
      saveAnswers: jest.fn().mockResolvedValue({ savedAt: new Date() }),
      submitBlock: jest.fn().mockResolvedValue({
        block: 'LESEN_SPRACHBAUSTEINE',
        submittedAt: new Date(),
        late: false,
        answers: { LESEN_1: { '1': 'a' } },
      }),
      attemptContextFor: jest.fn().mockResolvedValue({
        modelltestId: 'mt-1',
        modelltestNumber: 1,
        gradingTier: 'AI',
      }),
    };
    content = { getBlockContent: jest.fn().mockResolvedValue({}) };
    scoring = { scoreBlock: jest.fn().mockResolvedValue([]) };
    audio = { play: jest.fn().mockResolvedValue({ playsRemaining: 0 }) };
    release = {
      forStudent: jest.fn().mockResolvedValue({ outcome: 'PASSED' }),
    };
    speaking = {
      evaluateTranscript: jest.fn().mockResolvedValue({ score: 68 }),
    };
    controller = new ExamSittingController(
      sitting,
      content,
      scoring,
      audio,
      release,
      speaking,
    );
  });

  describe('the guards it carries', () => {
    it('authenticates every route', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        ExamSittingController,
      ) as unknown[];

      expect(guards).toContain(JwtAuthGuard);
    });

    it('does NOT require a live subscription', () => {
      // Deliberate. The center already paid for this candidate's place when
      // it published the sitting; refusing them because the school's monthly
      // plan lapsed would take the exam fee and grant nothing. The
      // participant row is the access rule here, not the subscription.
      const guards = Reflect.getMetadata(
        '__guards__',
        ExamSittingController,
      ) as unknown[];

      expect(guards).not.toContain(StudentSubscriptionGuard);
    });
  });

  describe('who it acts for', () => {
    it('takes the student from the token on every call', async () => {
      await controller.mySessions(student);
      await controller.start(student, 'session-1');
      await controller.getAttempt(student, 'attempt-1');
      await controller.startBlock(student, 'attempt-1', 'HOEREN');

      for (const call of [
        sitting.mySessions,
        sitting.start,
        sitting.getAttempt,
        sitting.startBlock,
      ]) {
        expect(call).toHaveBeenCalledWith(
          'student-1',
          ...call.mock.calls[0].slice(1),
        );
      }
    });
  });

  describe('the AI speaking session', () => {
    it('ties the transcript to this exam, so it never lands in practice', async () => {
      await controller.examSpeaking(student, 'attempt-1', {
        teilNumber: 1,
        transcript: 'Ich heisse Marie.',
      });

      expect(speaking.evaluateTranscript).toHaveBeenCalledWith(
        'student-1',
        1,
        'Ich heisse Marie.',
        expect.objectContaining({ examAttemptId: 'attempt-1' }),
      );
    });

    it('does not spend the training allowance, which is smaller than the exam', async () => {
      // The training allowance is two evaluations per window and a telc exam
      // has three Sprechen Teile. Charging the exam against it would refuse
      // a candidate on Teil 3, in the middle of a sitting their center paid
      // 1,500 XAF a head for.
      await controller.examSpeaking(student, 'attempt-1', {
        teilNumber: 3,
        transcript: 'Wir planen zusammen.',
      });

      expect(speaking.evaluateTranscript).toHaveBeenCalledWith(
        'student-1',
        3,
        'Wir planen zusammen.',
        expect.objectContaining({ skipQuota: true }),
      );
    });

    it('refuses on a sitting the center did not buy it for', async () => {
      // A manual sitting running the model would be a bill nobody agreed to.
      sitting.attemptContextFor.mockResolvedValue({
        modelltestId: 'mt-1',
        modelltestNumber: 1,
        gradingTier: 'MANUAL',
      });

      await expect(
        controller.examSpeaking(student, 'attempt-1', {
          teilNumber: 1,
          transcript: 'Ich heisse Marie.',
        }),
      ).rejects.toThrow('EXAM_TIER_WITHOUT_AI');
      expect(speaking.evaluateTranscript).not.toHaveBeenCalled();
    });
  });

  describe('my own result', () => {
    it('asks only for this student, and only for what was released', async () => {
      await controller.myResult(student, 'attempt-1');

      expect(release.forStudent).toHaveBeenCalledWith('student-1', 'attempt-1');
    });
  });

  describe('submitting a block', () => {
    it('scores what the submit settled on, not what the client sent', async () => {
      // A late submit keeps the answers saved before the deadline. Scoring
      // the request body instead would hand back time nobody had.
      await controller.submitBlock(
        student,
        'attempt-1',
        'LESEN_SPRACHBAUSTEINE',
        {
          answers: { LESEN_1: { '1': 'too-late' } },
        },
      );

      expect(scoring.scoreBlock).toHaveBeenCalledWith(
        expect.objectContaining({
          answers: { LESEN_1: { '1': 'a' } },
          attemptId: 'attempt-1',
          studentId: 'student-1',
        }),
      );
    });

    it('returns the scores beside the submission', async () => {
      scoring.scoreBlock.mockResolvedValue([
        { skill: 'LESEN', teil: '1', score: 75, pending: false },
      ]);

      const result = await controller.submitBlock(
        student,
        'attempt-1',
        'LESEN_SPRACHBAUSTEINE',
        { answers: {} },
      );

      expect(result).toMatchObject({
        late: false,
        sections: [{ skill: 'LESEN', teil: '1', score: 75 }],
      });
    });
  });
});
