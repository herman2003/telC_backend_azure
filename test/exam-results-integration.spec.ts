/**
 * Marking, the verdict and releasing, against real Postgres.
 *
 * The claims a mock cannot make: that the seeded weights really add to telc's
 * 225 and 75, that a mark upserts rather than piling up, and — the one that
 * matters most — that a released result does not move when somebody re-marks
 * afterwards.
 *
 * Runs against the disposable branch in `.env.test`, over the direct endpoint.
 */
import { PrismaService } from '../src/shared/services/prisma.service';
import { ExamResultService } from '../src/modules/centers/exam-result.service';
import { ExamGradingService } from '../src/modules/centers/exam-grading.service';
import { ExamReleaseService } from '../src/modules/centers/exam-release.service';
import type { SignedCenterIdentity } from '../src/modules/centers/payment-shared';

const prisma = new PrismaService();
const results = new ExamResultService(prisma);
const grading = new ExamGradingService(prisma);
const release = new ExamReleaseService(prisma, results);

const DAY = 24 * 60 * 60 * 1000;

async function wipe() {
  // Managers first: center_users has no cascade from centers.
  await prisma.centerUser.deleteMany({
    where: { email: { startsWith: 'results-test-' } },
  });
  await prisma.student.deleteMany({
    where: { email: { startsWith: 'results-test-' } },
  });
  await prisma.center.deleteMany({
    where: { name: { startsWith: 'Results Test' } },
  });
}

/**
 * A finished attempt with every automatic Teil marked at `percent`.
 *
 * Written straight into the attempt tables rather than by sitting the exam:
 * what is under test is the arithmetic and the release, and walking three
 * timed blocks to reach them would test phase 18 again.
 */
async function makeMarkedAttempt(percent: number) {
  const center = await prisma.center.create({
    data: {
      name: `Results Test ${Date.now()}-${Math.random()}`,
      country_code: 'CM',
      city_id: 'douala',
      subscription: { create: { plan: 'TRIAL' } },
    },
  });
  const manager = await prisma.centerUser.create({
    data: {
      center_id: center.id,
      first_name: 'Results',
      last_name: 'Tester',
      email: `results-test-${Date.now()}-${Math.random()}@example.com`,
      password_hash: 'x',
      phone: '+237600000000',
      email_verified: true,
    },
  });
  const student = await prisma.student.create({
    data: {
      email: `results-test-s-${Date.now()}-${Math.random()}@example.com`,
      center_id: center.id,
    },
  });
  const modelltest = await prisma.modelltest.findFirstOrThrow({
    where: { number: 1 },
    select: { id: true },
  });

  const session = await prisma.examSession.create({
    data: {
      center_id: center.id,
      name: 'Results Test sitting',
      level: 'B1',
      modelltest_id: modelltest.id,
      opens_at: new Date(Date.now() - DAY),
      closes_at: new Date(Date.now() + DAY),
      published_at: new Date(Date.now() - 2 * DAY),
      participants: { create: { student_id: student.id } },
    },
  });
  const attempt = await prisma.examAttempt.create({
    data: {
      session_id: session.id,
      student_id: student.id,
      submitted_at: new Date(),
      // Schreiben cannot be marked until its block is in — marking one still
      // being written would score a draft.
      blocks: {
        create: {
          block: 'SCHREIBEN',
          started_at: new Date(Date.now() - 60 * 60 * 1000),
          deadline_at: new Date(Date.now() - 30 * 60 * 1000),
          submitted_at: new Date(Date.now() - 30 * 60 * 1000),
        },
      },
    },
  });

  for (const teil of ['1', '2', '3']) {
    await prisma.lesenAttempt.create({
      data: {
        student_id: student.id,
        teil_id: teil,
        modelltest_id: modelltest.id,
        score: percent,
        answers: {},
        exam_attempt_id: attempt.id,
      },
    });
    await prisma.listeningAttempt.create({
      data: {
        student_id: student.id,
        exercise_id: teil,
        status: 'completed',
        score: percent,
        modelltest_id: modelltest.id,
        exam_attempt_id: attempt.id,
      },
    });
  }
  for (const teil of ['1', '2']) {
    await prisma.sprachbausteineAttempt.create({
      data: {
        student_id: student.id,
        teil_id: teil,
        modelltest_id: modelltest.id,
        status: 'completed',
        score: percent,
        answers: {},
        content_revision: '',
        exam_attempt_id: attempt.id,
      },
    });
  }

  const identity: SignedCenterIdentity = {
    centerId: center.id,
    centerUserId: manager.id,
  };
  return { center, student, session, attempt, identity, manager };
}

beforeEach(wipe);

afterAll(async () => {
  await wipe();
  await prisma.onModuleDestroy();
});

describe('the seeded telc weights', () => {
  it('add up to 225 written and 75 oral', async () => {
    // Every verdict rests on these numbers. A missing row would quietly
    // change what 60% means.
    const weights = await prisma.examSectionWeight.findMany({
      where: { level: 'B1' },
      select: { part: true, max_points: true },
    });

    const total = (part: string) =>
      weights
        .filter((w) => w.part === part)
        .reduce((sum, w) => sum + w.max_points, 0);

    expect(total('WRITTEN')).toBe(225);
    expect(total('ORAL')).toBe(75);
  });
});

describe('from marks to a verdict', () => {
  it('turns the automatic percentages into telc points', async () => {
    const { attempt, identity } = await makeMarkedAttempt(100);

    const result = await results.forAttempt(attempt.id, identity.centerId);

    // Everything automatic at full marks: 75 + 30 + 75 of the 225.
    expect(result.written.points).toBe(180);
    expect(result.awaiting).toEqual(['SCHREIBEN', 'SPRECHEN']);
    expect(result.outcome).toBe('INCOMPLETE');
  });

  it('reaches a verdict once a person has marked the other two', async () => {
    const { attempt, identity } = await makeMarkedAttempt(100);

    await grading.recordMark(identity, attempt.id, {
      skill: 'SCHREIBEN',
      teil: 1,
      points: 40,
    });
    await grading.recordMark(identity, attempt.id, {
      skill: 'SPRECHEN',
      teil: 1,
      points: 60,
      note: 'Oral on 12 Oct',
    });

    const result = await results.forAttempt(attempt.id, identity.centerId);

    expect(result.written.points).toBe(220);
    expect(result.oral.points).toBe(60);
    expect(result.outcome).toBe('PASSED');
  });

  it('fails a candidate who was strong on paper and quiet in the room', async () => {
    // The case telc marks the halves separately for.
    const { attempt, identity } = await makeMarkedAttempt(100);
    await grading.recordMark(identity, attempt.id, {
      skill: 'SCHREIBEN',
      teil: 1,
      points: 45,
    });
    await grading.recordMark(identity, attempt.id, {
      skill: 'SPRECHEN',
      teil: 1,
      points: 30,
    });

    const result = await results.forAttempt(attempt.id, identity.centerId);

    expect(result.written.passed).toBe(true);
    expect(result.oral.passed).toBe(false);
    expect(result.outcome).toBe('FAILED');
  });

  it('re-marks in place rather than piling marks up', async () => {
    const { attempt, identity } = await makeMarkedAttempt(100);

    await grading.recordMark(identity, attempt.id, {
      skill: 'SCHREIBEN',
      teil: 1,
      points: 20,
    });
    await grading.recordMark(identity, attempt.id, {
      skill: 'SCHREIBEN',
      teil: 1,
      points: 40,
    });

    const rows = await prisma.examSectionResult.findMany({
      where: { attempt_id: attempt.id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ points: 40, graded_by: identity.centerUserId });
  });

  it('refuses another center\'s attempt', async () => {
    const mine = await makeMarkedAttempt(100);
    const theirs = await makeMarkedAttempt(100);

    await expect(
      results.forAttempt(theirs.attempt.id, mine.identity.centerId),
    ).rejects.toThrow('EXAM_ATTEMPT_NOT_FOUND');
  });
});

describe('releasing', () => {
  const complete = async () => {
    const made = await makeMarkedAttempt(100);
    await grading.recordMark(made.identity, made.attempt.id, {
      skill: 'SCHREIBEN',
      teil: 1,
      points: 40,
    });
    await grading.recordMark(made.identity, made.attempt.id, {
      skill: 'SPRECHEN',
      teil: 1,
      points: 60,
    });
    return made;
  };

  it('refuses while a mark is missing, and says how many', async () => {
    const { session, identity } = await makeMarkedAttempt(100);

    await expect(
      release.releaseSession(identity, session.id),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ message: 'RESULTS_INCOMPLETE' }),
    });
  });

  it('releases anyway when the center says so', async () => {
    const { session, identity, student, attempt } =
      await makeMarkedAttempt(100);

    const summary = await release.releaseSession(identity, session.id, {
      allowIncomplete: true,
    });

    expect(summary).toMatchObject({ released: 1, incomplete: 1 });
    await expect(
      release.forStudent(student.id, attempt.id),
    ).resolves.toMatchObject({ outcome: 'INCOMPLETE' });
  });

  it('shows the candidate nothing until it is released', async () => {
    const { student, attempt } = await complete();

    await expect(
      release.forStudent(student.id, attempt.id),
    ).rejects.toThrow('RESULT_NOT_RELEASED');
  });

  it('does not change what a candidate was told when a mark is revisited', async () => {
    // The claim the whole snapshot exists for. A live view would tell Marie
    // she failed, silently, between two refreshes.
    const { session, identity, student, attempt } = await complete();
    await release.releaseSession(identity, session.id);

    await expect(
      release.forStudent(student.id, attempt.id),
    ).resolves.toMatchObject({ outcome: 'PASSED' });

    // The trainer notices the Schreiben mark was a typo.
    await grading.recordMark(identity, attempt.id, {
      skill: 'SPRECHEN',
      teil: 1,
      points: 10,
    });

    // The live result has changed; what she was told has not.
    await expect(
      results.forAttempt(attempt.id, identity.centerId),
    ).resolves.toMatchObject({ outcome: 'FAILED' });
    await expect(
      release.forStudent(student.id, attempt.id),
    ).resolves.toMatchObject({ outcome: 'PASSED' });
  });

  it('shows the correction once the center releases again', async () => {
    const { session, identity, student, attempt } = await complete();
    await release.releaseSession(identity, session.id);
    await grading.recordMark(identity, attempt.id, {
      skill: 'SPRECHEN',
      teil: 1,
      points: 10,
    });

    await release.releaseSession(identity, session.id);

    await expect(
      release.forStudent(student.id, attempt.id),
    ).resolves.toMatchObject({ outcome: 'FAILED' });
  });

  it('shows one candidate nothing of another\'s', async () => {
    const mine = await complete();
    const theirs = await complete();
    await release.releaseSession(theirs.identity, theirs.session.id);

    await expect(
      release.forStudent(mine.student.id, theirs.attempt.id),
    ).rejects.toThrow('EXAM_ATTEMPT_NOT_FOUND');
  });
});

describe('the table a manager reads', () => {
  it('lists the candidates of one sitting with their verdicts', async () => {
    const { session, identity } = await makeMarkedAttempt(100);

    const table = await results.forSession(identity.centerId, session.id);

    expect(table.candidates).toHaveLength(1);
    expect(table.summary).toMatchObject({ candidates: 1, awaitingMarks: 1 });
  });

  it('refuses a sitting belonging to another center', async () => {
    const mine = await makeMarkedAttempt(100);
    const theirs = await makeMarkedAttempt(100);

    await expect(
      results.forSession(mine.identity.centerId, theirs.session.id),
    ).rejects.toThrow('EXAM_SESSION_NOT_FOUND');
  });
});
