import { ForbiddenException } from '@nestjs/common';
import { EvaluationService } from '../src/modules/speaking/services/evaluation.service';
import { SpeakingController } from '../src/modules/speaking/speaking.controller';
import { JwtAuthGuard } from '../src/shared/guards/jwt-auth.guard';
import { GuestBlockGuard } from '../src/shared/guards/guest-block.guard';
import { StudentSubscriptionGuard } from '../src/shared/guards/student-subscription.guard';

/**
 * The quota where it actually costs money.
 *
 * Two orderings are the whole task, and getting either backwards is a defect
 * nobody would see in a happy-path test:
 *
 *  - the check runs BEFORE the AI call, or a student over their allowance
 *    still costs us a Gemini request;
 *  - the row is written AFTER it succeeds, or our own outage spends a Start
 *    student's session and hands them nothing.
 */
describe('speaking evaluation and the AI quota', () => {
  /** The shape `parseResponse` accepts: M10 letters (points computed in code). */
  const A_RESULT = {
    expression: 'A',
    taskFulfilment: 'A',
    formalAccuracy: 'A',
    pronunciation: 'A',
    evaluation_text: 'Gut gemacht.',
    corrections: [],
  };

  let gemini: { generateTextResponse: jest.Mock };
  let usage: { recordDelivered: jest.Mock };
  let rateLimit: { checkAiEvaluationLimit: jest.Mock };
  let prisma: any;
  let service: EvaluationService;

  beforeEach(() => {
    prisma = {
      modelltest: { findUnique: jest.fn().mockResolvedValue({ id: 'mt-1' }) },
      speakingAttempt: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      student: { findUnique: jest.fn().mockResolvedValue({ id: 'student-1' }) },
      studentActivity: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((work: any) => work(prisma)),
    };
    gemini = {
      generateTextResponse: jest
        .fn()
        .mockResolvedValue(JSON.stringify(A_RESULT)),
    };
    usage = { recordDelivered: jest.fn().mockResolvedValue(undefined) };
    rateLimit = {
      checkAiEvaluationLimit: jest.fn().mockResolvedValue(undefined),
    };

    service = new EvaluationService(
      gemini as never,
      usage as never,
      rateLimit as never,
      prisma as never,
    );
  });

  const evaluate = (studentId: string | undefined = 'student-1') =>
    service.evaluateTranscript(studentId, 1, 'Ich heiße Awa und ich wohne...');

  /** Explicitly anonymous. Not `evaluate(undefined)`: passing undefined to a
   *  parameter with a default silently uses the default. */
  const evaluateAnonymously = () =>
    service.evaluateTranscript(undefined, 1, 'Ich heiße Awa...');

  describe('before the AI call', () => {
    // The allowance moved. Until 2026-09-25 grading had one of its own, two
    // per rolling day, checked here. It does not any more: what Lerniqo sells
    // is the conversation, charged when it starts, and refusing the correction
    // that follows would take feedback away from a student who had already
    // paid for the session.
    it('does not call Gemini when the burst limit refuses', async () => {
      // The point of checking first. A refusal after the call would cost us
      // the request and give the student nothing.
      rateLimit.checkAiEvaluationLimit.mockRejectedValue(
        new ForbiddenException({ message: 'RATE_LIMITED' }),
      );

      await expect(evaluate()).rejects.toThrow('RATE_LIMITED');
      expect(gemini.generateTextResponse).not.toHaveBeenCalled();
    });

    it('records nothing when the burst limit refuses', async () => {
      rateLimit.checkAiEvaluationLimit.mockRejectedValue(
        new ForbiddenException({ message: 'RATE_LIMITED' }),
      );

      await expect(evaluate()).rejects.toThrow('RATE_LIMITED');
      expect(usage.recordDelivered).not.toHaveBeenCalled();
    });

    it('lets the refusal through unchanged, numbers and all', async () => {
      // A refusal is a sales moment. Wrapping it would strip the figures a
      // client needs to say something useful.
      const refusal = new ForbiddenException({
        message: 'RATE_LIMITED',
        retryAfterSeconds: 120,
      });
      rateLimit.checkAiEvaluationLimit.mockRejectedValue(refusal);

      await expect(evaluate()).rejects.toBe(refusal);
    });
  });

  describe('after the AI call', () => {
    it('records one operation on success', async () => {
      await evaluate();

      expect(usage.recordDelivered).toHaveBeenCalledWith(
        'student-1',
        'SPEAKING_EVALUATION',
      );
    });

    it('records nothing when Gemini fails', async () => {
      // Metered APIs do not bill a 500. A Gemini failure must not spend one
      // of a Start student's two daily sessions.
      gemini.generateTextResponse.mockRejectedValue(new Error('upstream down'));

      await expect(evaluate()).rejects.toThrow();
      expect(usage.recordDelivered).not.toHaveBeenCalled();
    });

    it('records nothing when the response cannot be parsed', async () => {
      // A reply we cannot use is not a session the student had.
      gemini.generateTextResponse.mockResolvedValue('not json at all');

      await expect(evaluate()).rejects.toThrow();
      expect(usage.recordDelivered).not.toHaveBeenCalled();
    });

    it('still returns the evaluation when the meter cannot be written', async () => {
      // recordDelivered swallows its own failures; this asserts the caller
      // does not reintroduce one. The student has earned this result.
      usage.recordDelivered.mockRejectedValue(new Error('offline'));

      await expect(evaluate()).resolves.toMatchObject({
        evaluationText: 'Gut gemacht.',
      });
    });
  });

  describe('the order is not an accident', () => {
    it('checks, then calls, then records', async () => {
      const order: string[] = [];
      rateLimit.checkAiEvaluationLimit.mockImplementation(() => {
        order.push('limit');
        return Promise.resolve();
      });
      gemini.generateTextResponse.mockImplementation(() => {
        order.push('call');
        return Promise.resolve(JSON.stringify(A_RESULT));
      });
      usage.recordDelivered.mockImplementation(() => {
        order.push('record');
        return Promise.resolve();
      });

      await evaluate();

      // The row is written after the model answers, never before: a failure
      // on our side must not spend something the student then does not get.
      expect(order).toEqual(['limit', 'call', 'record']);
    });
  });

  describe('keeping the result (D26)', () => {
    const ID = '6f1c1f5e-2b1a-4b8e-9a51-0c0de0c0de00';

    it('stores the evaluation and records Sprechen activity together', async () => {
      await service.evaluateTranscript('student-1', 2, 'Ich heiße Awa...', {
        durationSeconds: 120,
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const stored = prisma.speakingAttempt.create.mock.calls[0][0].data;
      expect(stored).toMatchObject({
        student_id: 'student-1',
        teil_number: 2,
        modelltest_id: 'mt-1',
        // AAAA on Teil 2 → 30/30 → overall 100
        score: 100,
        duration_seconds: 120,
      });
      expect(stored.evaluation.telcRating).toMatchObject({
        points: 30,
        maxPoints: 30,
        teilNumber: 2,
      });
      expect(prisma.studentActivity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          skill: 'SPRECHEN',
          teil: 2,
          score: 100,
          attempt_id: stored.attempt_id,
        }),
      });
    });

    it('answers a repeated attempt from storage, spending nothing', async () => {
      const earlier = { scores: { overall: 70 }, evaluationText: 'Früher.' };
      prisma.speakingAttempt.findUnique.mockResolvedValue({
        student_id: 'student-1',
        evaluation: earlier,
      });

      const result = await service.evaluateTranscript(
        'student-1',
        1,
        'Ich...',
        {
          attemptId: ID,
        },
      );

      expect(result).toEqual(earlier);
      expect(gemini.generateTextResponse).not.toHaveBeenCalled();
      expect(prisma.speakingAttempt.create).not.toHaveBeenCalled();
    });

    it("refuses an attempt id that is another student's", async () => {
      prisma.speakingAttempt.findUnique.mockResolvedValue({
        student_id: 'student-2',
        evaluation: {},
      });

      await expect(
        service.evaluateTranscript('student-1', 1, 'Ich...', { attemptId: ID }),
      ).rejects.toThrow('ATTEMPT_ID_TAKEN');
      expect(gemini.generateTextResponse).not.toHaveBeenCalled();
    });

    it('derives score from M10 letters and ignores a model numeric overall', async () => {
      gemini.generateTextResponse.mockResolvedValue(
        JSON.stringify({ ...A_RESULT, overall_score: 12 }),
      );

      await evaluate();

      // Teil 1 AAAA → 15/15 → 100, not the model's 12
      expect(prisma.speakingAttempt.create.mock.calls[0][0].data.score).toBe(
        100,
      );
      expect(prisma.studentActivity.create).toHaveBeenCalled();
    });

    it('refuses an unknown Modelltest before anything costs money', async () => {
      prisma.modelltest.findUnique.mockResolvedValue(null);

      await expect(
        service.evaluateTranscript('student-1', 1, 'Ich...', {
          modelltestNumber: 9,
        }),
      ).rejects.toThrow('Modelltest 9 not found');
      expect(gemini.generateTextResponse).not.toHaveBeenCalled();
    });

    it('still returns the evaluation when it cannot be stored', async () => {
      prisma.$transaction.mockRejectedValue(new Error('db down'));

      await expect(evaluate()).resolves.toMatchObject({
        scores: expect.objectContaining({ overall: 100 }),
        telcRating: expect.objectContaining({ points: 15, maxPoints: 15 }),
      });
    });
  });

  describe('a request with no student', () => {
    it('is not recorded, because there is nobody to record it against', async () => {
      // The same choice StudentSubscriptionGuard makes: a token naming nobody
      // has nobody to look up. Charging an anonymous caller is impossible, and
      // refusing them here would be a decision about authentication taken in
      // the wrong place.
      await expect(evaluateAnonymously()).resolves.toBeDefined();

      expect(usage.recordDelivered).not.toHaveBeenCalled();
    });
  });

  describe('grading no longer has an allowance of its own', () => {
    // The conversation is the unit Start sells, and it is charged when it
    // starts. Charging the correction that follows it as well would refuse a
    // student their feedback on a session they had already paid for — the
    // phase 21 bug with different names: three Sprechen Teile meeting an
    // allowance of two.
    //
    // There is no assertion here that the old allowance is unchecked, because
    // the service no longer takes AiQuotaService at all — a test for that
    // would be asserting against a constructor parameter that does not exist.
    // What is left to protect is the limit that remains.
    it('still obeys the burst limit, which is about our bill', async () => {
      // Twenty an hour. It bounds how fast anybody can pile calls into the
      // model, which is a different question from what they are entitled to.
      await evaluate();

      expect(rateLimit.checkAiEvaluationLimit).toHaveBeenCalledWith(
        'student-1',
      );
    });
  });

  describe('inside an exam, which was paid for separately', () => {
    // The practice allowance is two per window. A telc Sprechen has three
    // Teile, so charging the exam against it would refuse a candidate on
    // Teil 3, mid-sitting, on a 1,500 XAF-a-head product.
    const inExam = (teil: number) =>
      service.evaluateTranscript('student-1', teil, 'Wir planen zusammen.', {
        examAttemptId: 'exam-attempt-1',
      });

    it('reaches the model at all, on the Teil the exam asked for', async () => {
      await inExam(3);

      expect(gemini.generateTextResponse).toHaveBeenCalled();
    });

    it('still obeys the burst limit, which is about our bill', async () => {
      await inExam(1);

      expect(rateLimit.checkAiEvaluationLimit).toHaveBeenCalledWith(
        'student-1',
      );
    });

    it('allows one evaluation per Teil and no more', async () => {
      // The bound that replaces the allowance. Without it, skipping the quota
      // would leave an exam candidate able to call the model in a loop.
      prisma.speakingAttempt.findFirst.mockResolvedValue({ id: 'earlier' });

      await expect(inExam(2)).rejects.toThrow('EXAM_TEIL_ALREADY_EVALUATED');
      expect(gemini.generateTextResponse).not.toHaveBeenCalled();
    });

    it('looks for the earlier one by attempt and Teil, not by student', async () => {
      // By student would refuse the candidate's second Teil; by attempt alone
      // would refuse all three.
      await inExam(2);

      expect(prisma.speakingAttempt.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { exam_attempt_id: 'exam-attempt-1', teil_number: 2 },
        }),
      );
    });

    it('leaves training alone: no exam, no per-Teil check', async () => {
      await evaluate();

      expect(prisma.speakingAttempt.findFirst).not.toHaveBeenCalled();
      expect(gemini.generateTextResponse).toHaveBeenCalled();
    });
  });
});

/**
 * The door, as opposed to the meter.
 *
 * A guest token is the one caller the quota could never count: it carries a
 * random uuid and no `students` row, so every `ai_usage` insert fails the
 * foreign key and `recordDelivered` swallows it. Unmetered paid calls, no
 * credentials required. `GuestBlockGuard` was written for exactly this, was
 * promised by the guest-session documentation, and was mounted nowhere.
 */
describe('the guards on the speaking controller', () => {
  const guardsOn = (target: object): unknown[] =>
    (Reflect.getMetadata('__guards__', target) ?? []) as unknown[];

  it('refuses guests before anything costs money', () => {
    expect(guardsOn(SpeakingController)).toContain(GuestBlockGuard);
  });

  it('still authenticates and still checks the subscription', () => {
    const guards = guardsOn(SpeakingController);

    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(StudentSubscriptionGuard);
  });

  it('identifies the caller before deciding whether they are a guest', () => {
    // GuestBlockGuard reads request.student, which JwtAuthGuard puts there.
    // Reversed, it would see no student, find no isGuest flag, and admit
    // every guest — a guard that looks like protection and is not.
    const guards = guardsOn(SpeakingController);

    expect(guards.indexOf(JwtAuthGuard)).toBeLessThan(
      guards.indexOf(GuestBlockGuard),
    );
  });
});
