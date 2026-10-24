/**
 * Sitting an exam, against real Postgres.
 *
 * Three claims here are about statements rather than about outputs, and a
 * mocked Prisma makes all three come out wrong: a deadline that survives a
 * reload, one attempt under two simultaneous starts, and a play counted once
 * when two presses arrive together.
 *
 * Runs against the disposable branch in `.env.test`, over the direct endpoint.
 */
import { PrismaService } from '../src/shared/services/prisma.service';
import { ExamSittingService } from '../src/modules/centers/exam-sitting.service';
import { ExamSessionPolicyService } from '../src/modules/centers/exam-session-policy.service';
import { ExamAudioService } from '../src/modules/centers/exam-audio.service';
import { ExamSessionsService } from '../src/modules/centers/exam-sessions.service';
import { ExamParticipantsService } from '../src/modules/centers/exam-participants.service';
import { NotificationsService } from '../src/shared/services/notifications.service';
import { SubscriptionPolicyService } from '../src/modules/centers/subscription-policy.service';
import { TrialGiftVoidService } from '../src/modules/centers/trial-gift-void.service';

const prisma = new PrismaService();
const policy = new ExamSessionPolicyService();
const sitting = new ExamSittingService(prisma, policy);
const audio = new ExamAudioService(prisma, 'a-secret-at-least-32-chars-long!!');
const sessions = new ExamSessionsService(prisma, policy);
const participants = new ExamParticipantsService(
  prisma,
  policy,
  new NotificationsService(prisma),
  new TrialGiftVoidService(prisma, new SubscriptionPolicyService()),
);

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

async function wipe() {
  await prisma.student.deleteMany({
    where: { email: { startsWith: 'sitting-test-' } },
  });
  await prisma.center.deleteMany({
    where: { name: { startsWith: 'Sitting Test' } },
  });
}

/** A published sitting that is open now, with one candidate admitted. */
async function makeOpenSitting(tier: 'MANUAL' | 'AI' = 'MANUAL') {
  const center = await prisma.center.create({
    data: {
      name: `Sitting Test ${Date.now()}-${Math.random()}`,
      country_code: 'CM',
      city_id: 'douala',
      exam_slots_remaining: 10,
      exam_ai_slots_remaining: 10,
      subscription: { create: { plan: 'TRIAL' } },
    },
  });
  const student = await prisma.student.create({
    data: {
      email: `sitting-test-${Date.now()}-${Math.random()}@example.com`,
      center_id: center.id,
    },
  });

  const identity = {
    centerId: center.id,
    centerUserId: `${center.id}-owner`,
  } as never;
  const draft = await sessions.create(identity, {
    name: 'Sitting Test exam',
    modelltestNumber: 1,
    opensAt: new Date(Date.now() + 2 * MINUTE),
    accessWindowHours: 24,
  });
  await participants.setParticipants(identity, draft.id, [student.id]);
  await participants.publish(identity, draft.id, tier);

  // Published two minutes ahead so publish accepts it, then moved back so it
  // is open now. Publishing into the past is refused on purpose.
  await prisma.examSession.update({
    where: { id: draft.id },
    data: { opens_at: new Date(Date.now() - MINUTE) },
  });

  return { center, student, sessionId: draft.id };
}

beforeEach(wipe);

afterAll(async () => {
  await wipe();
  await prisma.onModuleDestroy();
});

describe('starting an exam', () => {
  it('creates one attempt when two taps arrive at the same moment', async () => {
    // The claim the unique index exists for. A read-then-create would give a
    // candidate two attempts and two sets of timers.
    const { student, sessionId } = await makeOpenSitting();

    const both = await Promise.all([
      sitting.start(student.id, sessionId),
      sitting.start(student.id, sessionId),
    ]);

    expect(both[0].id).toBe(both[1].id);
    await expect(
      prisma.examAttempt.count({ where: { session_id: sessionId } }),
    ).resolves.toBe(1);
  });

  it('refuses a student the center never admitted', async () => {
    const { sessionId } = await makeOpenSitting();
    const outsider = await prisma.student.create({
      data: { email: `sitting-test-out-${Date.now()}@example.com` },
    });

    await expect(sitting.start(outsider.id, sessionId)).rejects.toThrow(
      'NOT_A_PARTICIPANT',
    );
  });
});

describe('the clock', () => {
  it('gives back the same deadline after a reload, not a fresh ninety minutes', async () => {
    // The whole reason the deadline is an instant. A stored "minutes
    // remaining" would restart here, and a candidate could refresh for ever.
    const { student, sessionId } = await makeOpenSitting();
    const attempt = await sitting.start(student.id, sessionId);

    const first = await sitting.startBlock(
      student.id,
      attempt.id,
      'LESEN_SPRACHBAUSTEINE',
    );
    const afterReload = await sitting.startBlock(
      student.id,
      attempt.id,
      'LESEN_SPRACHBAUSTEINE',
    );

    expect(afterReload.deadlineAt).toEqual(first.deadlineAt);
  });

  it('counts down from the stored instant rather than from the visit', async () => {
    const { student, sessionId } = await makeOpenSitting();
    const attempt = await sitting.start(student.id, sessionId);
    await sitting.startBlock(student.id, attempt.id, 'LESEN_SPRACHBAUSTEINE');

    // As if the candidate began forty minutes ago.
    await prisma.examAttemptBlock.updateMany({
      where: { attempt_id: attempt.id },
      data: {
        started_at: new Date(Date.now() - 40 * MINUTE),
        deadline_at: new Date(Date.now() + 50 * MINUTE),
      },
    });

    const view = await sitting.getAttempt(student.id, attempt.id);
    const block = view.blocks.find((b) => b.block === 'LESEN_SPRACHBAUSTEINE')!;

    expect(block.remainingSeconds).toBeGreaterThan(49 * 60);
    expect(block.remainingSeconds).toBeLessThanOrEqual(50 * 60);
    expect(block.state).toBe('RUNNING');
  });

  it('refuses a deadline that would close before it opens', async () => {
    // The database's own backstop for the timer arithmetic.
    const { student, sessionId } = await makeOpenSitting();
    const attempt = await sitting.start(student.id, sessionId);

    await expect(
      prisma.examAttemptBlock.create({
        data: {
          attempt_id: attempt.id,
          block: 'HOEREN',
          started_at: new Date(),
          deadline_at: new Date(Date.now() - HOUR),
        },
      }),
    ).rejects.toThrow();
  });
});

describe('answers and submitting', () => {
  it('keeps what was saved, and marks a late submit on it', async () => {
    const { student, sessionId } = await makeOpenSitting();
    const attempt = await sitting.start(student.id, sessionId);
    await sitting.startBlock(student.id, attempt.id, 'LESEN_SPRACHBAUSTEINE');

    await sitting.saveAnswers(student.id, attempt.id, 'LESEN_SPRACHBAUSTEINE', {
      LESEN_1: { '1': 'saved-in-time' },
    });

    // The clock runs out before the submit lands. started_at moves with it:
    // the database refuses a block that closes before it opens, which is the
    // constraint doing its job even on a fixture.
    await prisma.examAttemptBlock.updateMany({
      where: { attempt_id: attempt.id },
      data: {
        started_at: new Date(Date.now() - 2 * HOUR),
        deadline_at: new Date(Date.now() - 1000),
      },
    });

    const submitted = await sitting.submitBlock(
      student.id,
      attempt.id,
      'LESEN_SPRACHBAUSTEINE',
      { LESEN_1: { '1': 'too-late' } },
    );

    expect(submitted.late).toBe(true);
    expect(submitted.answers).toEqual({ LESEN_1: { '1': 'saved-in-time' } });
  });

  it('refuses to save once the time has gone', async () => {
    const { student, sessionId } = await makeOpenSitting();
    const attempt = await sitting.start(student.id, sessionId);
    await sitting.startBlock(student.id, attempt.id, 'LESEN_SPRACHBAUSTEINE');
    await prisma.examAttemptBlock.updateMany({
      where: { attempt_id: attempt.id },
      data: {
        started_at: new Date(Date.now() - 2 * HOUR),
        deadline_at: new Date(Date.now() - 1000),
      },
    });

    await expect(
      sitting.saveAnswers(student.id, attempt.id, 'LESEN_SPRACHBAUSTEINE', {
        LESEN_1: { '1': 'x' },
      }),
    ).rejects.toThrow('BLOCK_EXPIRED');
  });

  it('closes a block once, however many submits arrive together', async () => {
    const { student, sessionId } = await makeOpenSitting();
    const attempt = await sitting.start(student.id, sessionId);
    await sitting.startBlock(student.id, attempt.id, 'LESEN_SPRACHBAUSTEINE');

    const results = await Promise.allSettled([
      sitting.submitBlock(student.id, attempt.id, 'LESEN_SPRACHBAUSTEINE'),
      sitting.submitBlock(student.id, attempt.id, 'LESEN_SPRACHBAUSTEINE'),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('runs the blocks in telc order and no other', async () => {
    const { student, sessionId } = await makeOpenSitting();
    const attempt = await sitting.start(student.id, sessionId);

    await expect(
      sitting.startBlock(student.id, attempt.id, 'SCHREIBEN'),
    ).rejects.toThrow('BLOCK_OUT_OF_ORDER');

    await sitting.startBlock(student.id, attempt.id, 'LESEN_SPRACHBAUSTEINE');
    await sitting.submitBlock(student.id, attempt.id, 'LESEN_SPRACHBAUSTEINE');
    await expect(
      sitting.startBlock(student.id, attempt.id, 'HOEREN'),
    ).resolves.toMatchObject({ block: 'HOEREN' });
  });

  it('finishes the attempt when the last block is in', async () => {
    const { student, sessionId } = await makeOpenSitting();
    const attempt = await sitting.start(student.id, sessionId);

    for (const block of [
      'LESEN_SPRACHBAUSTEINE',
      'HOEREN',
      'SCHREIBEN',
    ] as const) {
      await sitting.startBlock(student.id, attempt.id, block);
      await sitting.submitBlock(student.id, attempt.id, block);
    }

    await expect(
      sitting.getAttempt(student.id, attempt.id),
    ).resolves.toMatchObject({ submittedAt: expect.any(Date) });
  });
});

describe('playing a recording', () => {
  /** The Hören exercise of Modelltest 1, as seeded. */
  const anAudio = async () =>
    prisma.listeningExercise.findFirstOrThrow({
      where: { modelltest: { number: 1 }, part: 1 },
      select: { id: true },
    });

  const startHoeren = async () => {
    const { student, sessionId } = await makeOpenSitting();
    const attempt = await sitting.start(student.id, sessionId);
    await sitting.startBlock(student.id, attempt.id, 'LESEN_SPRACHBAUSTEINE');
    await sitting.submitBlock(student.id, attempt.id, 'LESEN_SPRACHBAUSTEINE');
    await sitting.startBlock(student.id, attempt.id, 'HOEREN');
    return { student, attempt };
  };

  it('spends one play, and refuses the second', async () => {
    // telc's repeat is inside the recording, so one press is the allowance.
    const { student, attempt } = await startHoeren();
    const { id: audioId } = await anAudio();
    await prisma.listeningExercise.update({
      where: { id: audioId },
      data: { duration_minutes: 6, exam_plays_allowed: 1 },
    });

    const first = await audio.play(student.id, attempt.id, audioId);
    expect(first.playsRemaining).toBe(0);

    await expect(audio.play(student.id, attempt.id, audioId)).rejects.toThrow(
      'NO_PLAYS_LEFT',
    );
  });

  it('counts two presses arriving together as two plays, not one', async () => {
    // A read-then-write would let both see "none used yet" and hand out two
    // links against an allowance of one.
    const { student, attempt } = await startHoeren();
    const { id: audioId } = await anAudio();
    await prisma.listeningExercise.update({
      where: { id: audioId },
      data: { duration_minutes: 6, exam_plays_allowed: 2 },
    });

    await Promise.allSettled([
      audio.play(student.id, attempt.id, audioId),
      audio.play(student.id, attempt.id, audioId),
    ]);

    const row = await prisma.examAudioPlay.findUniqueOrThrow({
      where: {
        attempt_id_audio_id: { attempt_id: attempt.id, audio_id: audioId },
      },
      select: { plays_used: true },
    });
    expect(row.plays_used).toBe(2);
    await expect(audio.play(student.id, attempt.id, audioId)).rejects.toThrow(
      'NO_PLAYS_LEFT',
    );
  });

  it('signs a link this server accepts back', async () => {
    const { student, attempt } = await startHoeren();
    const { id: audioId } = await anAudio();
    await prisma.listeningExercise.update({
      where: { id: audioId },
      data: { duration_minutes: 6, exam_plays_allowed: 1 },
    });

    const granted = await audio.play(student.id, attempt.id, audioId);
    const token = new URL(granted.url, 'https://api.test').searchParams.get(
      'token',
    )!;

    expect(audio.verify(token)).toMatchObject({
      attemptId: attempt.id,
      audioId,
    });
  });

  it('refuses to play before the Hören block has started', async () => {
    const { student, sessionId } = await makeOpenSitting();
    const attempt = await sitting.start(student.id, sessionId);
    const { id: audioId } = await anAudio();

    await expect(audio.play(student.id, attempt.id, audioId)).rejects.toThrow(
      'BLOCK_NOT_STARTED',
    );
  });
});

describe('which exam a candidate is sitting', () => {
  // A sitting on the AI tier asks the candidate to speak, Teil by Teil, and
  // sends the transcript so the examiner can read it beside the mark they
  // are about to give. A MANUAL sitting asks for nothing: Sprechen happens
  // in the room and never touches the app.
  //
  // The app has to know which before it draws the screen. Until this, the
  // only way to find out was to send a transcript and be refused — so the
  // choice was between offering a button that fails and never offering it at
  // all, and the centres paying 1,500 a head got the second.

  it('tells the candidate which tier their sitting is', async () => {
    const { student, sessionId } = await makeOpenSitting('AI');

    const mine = await sitting.mySessions(student.id);

    expect(mine.find((row) => row.sessionId === sessionId)).toMatchObject({
      gradingTier: 'AI',
    });
  });

  it('says MANUAL when nobody bought the machine', async () => {
    const { student, sessionId } = await makeOpenSitting();

    const mine = await sitting.mySessions(student.id);

    expect(mine.find((row) => row.sessionId === sessionId)).toMatchObject({
      gradingTier: 'MANUAL',
    });
  });

  it('carries the tier on the attempt, which is the screen that needs it', async () => {
    const { student, sessionId } = await makeOpenSitting('AI');
    const attempt = await sitting.start(student.id, sessionId);

    const view = await sitting.getAttempt(student.id, attempt.id);

    expect(view).toMatchObject({ gradingTier: 'AI' });
  });

  it('carries MANUAL on the attempt too, rather than leaving it absent', async () => {
    // Absent and MANUAL are different things to a client: one is "no AI",
    // the other is "this backend is too old to say".
    const { student, sessionId } = await makeOpenSitting();
    const attempt = await sitting.start(student.id, sessionId);

    const view = await sitting.getAttempt(student.id, attempt.id);

    expect(view.gradingTier).toBe('MANUAL');
  });
});
