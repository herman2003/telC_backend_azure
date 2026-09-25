/**
 * Publishing a sitting, against real Postgres.
 *
 * Spending a slot per candidate is a claim about one transaction and about a
 * conditional update, and a mocked Prisma has neither: it will happily
 * publish twice, spend the last slot twice, and report success both times.
 *
 * Runs against the disposable branch in `.env.test`, over the direct endpoint.
 */
import { PrismaService } from '../src/shared/services/prisma.service';
import { ExamSessionsService } from '../src/modules/centers/exam-sessions.service';
import { ExamParticipantsService } from '../src/modules/centers/exam-participants.service';
import { ExamSessionPolicyService } from '../src/modules/centers/exam-session-policy.service';
import { NotificationsService } from '../src/shared/services/notifications.service';

const prisma = new PrismaService();
const policy = new ExamSessionPolicyService();
const sessions = new ExamSessionsService(prisma, policy);
const notifications = new NotificationsService(prisma);
const participants = new ExamParticipantsService(
  prisma,
  policy,
  notifications,
);

const identity = (centerId: string) =>
  ({ centerId, centerUserId: `${centerId}-owner` }) as never;

const HOUR = 60 * 60 * 1000;
const soon = () => new Date(Date.now() + 24 * HOUR);

async function wipe() {
  await prisma.student.deleteMany({
    where: { email: { startsWith: 'exam-test-' } },
  });
  await prisma.center.deleteMany({
    where: { name: { startsWith: 'Exam Test' } },
  });
}

async function makeCenter(slots: number) {
  return prisma.center.create({
    data: {
      name: `Exam Test ${Date.now()}-${Math.random()}`,
      exam_slots_remaining: slots,
      subscription: { create: { plan: 'TRIAL' } },
    },
  });
}

async function makeStudents(centerId: string, count: number) {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const student = await prisma.student.create({
      data: {
        email: `exam-test-${i}-${Date.now()}-${Math.random()}@example.com`,
        center_id: centerId,
      },
    });
    ids.push(student.id);
  }
  return ids;
}

/** Modelltest 1 is seeded in every database this runs against. */
const modelltestNumber = 1;

async function makeDraft(centerId: string) {
  return sessions.create(identity(centerId), {
    name: `Exam Test sitting ${Math.random()}`,
    modelltestNumber,
    opensAt: soon(),
    accessWindowHours: 48,
  });
}

const slotsOf = async (centerId: string) =>
  (
    await prisma.center.findUniqueOrThrow({
      where: { id: centerId },
      select: { exam_slots_remaining: true },
    })
  ).exam_slots_remaining;

beforeEach(wipe);

afterAll(async () => {
  await wipe();
  await prisma.onModuleDestroy();
});

describe('the seeded telc timings', () => {
  it('gives B1 one 90-minute block for Lesen and Sprachbausteine, then 30 and 30', async () => {
    // The single thing a per-Teil timer would get wrong, asserted against the
    // rows an exam will actually be timed from.
    const blocks = await prisma.examBlockDuration.findMany({
      where: { level: 'B1' },
      orderBy: { position: 'asc' },
      select: { block: true, minutes: true },
    });

    expect(blocks).toEqual([
      { block: 'LESEN_SPRACHBAUSTEINE', minutes: 90 },
      { block: 'HOEREN', minutes: 30 },
      { block: 'SCHREIBEN', minutes: 30 },
    ]);
  });

  it('has no row for Sprechen, which happens in the center', async () => {
    const all = await prisma.examBlockDuration.findMany({
      select: { block: true },
    });

    expect(all.map((row) => row.block)).not.toContain('SPRECHEN');
  });
});

describe('publishing a sitting', () => {
  it('spends one slot per candidate and opens nothing before its time', async () => {
    const center = await makeCenter(10);
    const students = await makeStudents(center.id, 6);
    const draft = await makeDraft(center.id);
    await participants.setParticipants(identity(center.id), draft.id, students);

    const result = await participants.publish(identity(center.id), draft.id);

    expect(result).toMatchObject({
      participantCount: 6,
      slotsSpent: 6,
      slotsRemaining: 4,
    });
    await expect(slotsOf(center.id)).resolves.toBe(4);
    // Published, but not yet open: the opening time has not passed.
    await expect(
      sessions.get(identity(center.id), draft.id),
    ).resolves.toMatchObject({ status: 'SCHEDULED' });
  });

  it('refuses when the center cannot cover every candidate', async () => {
    // Four slots, six candidates. Publishing four of them would be a school
    // discovering at 9am that two students cannot sit.
    const center = await makeCenter(4);
    const students = await makeStudents(center.id, 6);
    const draft = await makeDraft(center.id);
    await participants.setParticipants(identity(center.id), draft.id, students);

    await expect(
      participants.publish(identity(center.id), draft.id),
    ).rejects.toThrow('NOT_ENOUGH_EXAM_SLOTS');

    // And nothing was taken on the way to refusing.
    await expect(slotsOf(center.id)).resolves.toBe(4);
    await expect(
      sessions.get(identity(center.id), draft.id),
    ).resolves.toMatchObject({ status: 'DRAFT' });
  });

  it('spends nothing the second time the same sitting is published', async () => {
    const center = await makeCenter(10);
    const students = await makeStudents(center.id, 3);
    const draft = await makeDraft(center.id);
    await participants.setParticipants(identity(center.id), draft.id, students);
    await participants.publish(identity(center.id), draft.id);

    await expect(
      participants.publish(identity(center.id), draft.id),
    ).rejects.toThrow('EXAM_ALREADY_PUBLISHED');
    await expect(slotsOf(center.id)).resolves.toBe(7);
  });

  it('publishes once when a double click arrives as two requests at once', async () => {
    // The case the unique claim exists for. A read-then-write would let both
    // pass the "not published yet" check and spend six slots for three
    // candidates.
    const center = await makeCenter(10);
    const students = await makeStudents(center.id, 3);
    const draft = await makeDraft(center.id);
    await participants.setParticipants(identity(center.id), draft.id, students);

    const results = await Promise.allSettled([
      participants.publish(identity(center.id), draft.id),
      participants.publish(identity(center.id), draft.id),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    await expect(slotsOf(center.id)).resolves.toBe(7);
  });

  it('tells every candidate, in the transaction that published it', async () => {
    // An exam published with nobody told is worse than a publish that
    // failed: only one of the two is visible to anybody.
    const center = await makeCenter(10);
    const students = await makeStudents(center.id, 3);
    const draft = await makeDraft(center.id);
    await participants.setParticipants(identity(center.id), draft.id, students);

    await participants.publish(identity(center.id), draft.id);

    const told = await prisma.notification.findMany({
      where: { student_id: { in: students }, kind: 'EXAM_PUBLISHED' },
      select: { student_id: true, payload: true },
    });
    expect(told).toHaveLength(3);
    // Facts, not a sentence: the app writes the wording.
    expect(told[0].payload).toMatchObject({ sessionId: draft.id });
  });

  it('tells nobody when the publish is refused', async () => {
    // Four slots, six candidates. The refusal has to take the notifications
    // with it, or three students are waiting for an exam that never opened.
    const center = await makeCenter(4);
    const students = await makeStudents(center.id, 6);
    const draft = await makeDraft(center.id);
    await participants.setParticipants(identity(center.id), draft.id, students);

    await expect(
      participants.publish(identity(center.id), draft.id),
    ).rejects.toThrow('NOT_ENOUGH_EXAM_SLOTS');

    await expect(
      prisma.notification.count({ where: { student_id: { in: students } } }),
    ).resolves.toBe(0);
  });

  it('refuses a sitting nobody is admitted to', async () => {
    const center = await makeCenter(10);
    const draft = await makeDraft(center.id);

    await expect(
      participants.publish(identity(center.id), draft.id),
    ).rejects.toThrow('NO_PARTICIPANTS');
  });

  it('never lets a slot balance go below zero', async () => {
    // The database's own backstop, asserted directly: if the conditional
    // update above were ever wrong, this constraint is what stops a center
    // sitting exams it has not paid for.
    const center = await makeCenter(1);

    await expect(
      prisma.center.update({
        where: { id: center.id },
        data: { exam_slots_remaining: { decrement: 5 } },
      }),
    ).rejects.toThrow();
  });
});

describe('the admitted list', () => {
  it('charges for a candidate added after publication, and refunds nobody on removal', async () => {
    // The exam is already sold; a late candidate is a late sale. Removing one
    // gives nothing back, because a fee is spent when it is booked.
    const center = await makeCenter(10);
    const students = await makeStudents(center.id, 4);
    const draft = await makeDraft(center.id);
    await participants.setParticipants(
      identity(center.id),
      draft.id,
      students.slice(0, 3),
    );
    await participants.publish(identity(center.id), draft.id);

    await participants.setParticipants(identity(center.id), draft.id, students);
    await expect(slotsOf(center.id)).resolves.toBe(6);

    await participants.setParticipants(
      identity(center.id),
      draft.id,
      students.slice(0, 1),
    );
    await expect(slotsOf(center.id)).resolves.toBe(6);
  });

  it('costs nothing while the sitting is still a draft', async () => {
    const center = await makeCenter(10);
    const students = await makeStudents(center.id, 5);
    const draft = await makeDraft(center.id);

    await participants.setParticipants(identity(center.id), draft.id, students);

    await expect(slotsOf(center.id)).resolves.toBe(10);
  });

  it('refuses a student who belongs to another center', async () => {
    const mine = await makeCenter(10);
    const theirs = await makeCenter(10);
    const [theirStudent] = await makeStudents(theirs.id, 1);
    const draft = await makeDraft(mine.id);

    await expect(
      participants.setParticipants(identity(mine.id), draft.id, [theirStudent]),
    ).rejects.toThrow('STUDENT_NOT_IN_CENTER');
  });

  it('lists the center students, marking who is in and who has seen the Modelltest', async () => {
    const center = await makeCenter(10);
    const students = await makeStudents(center.id, 3);
    const draft = await makeDraft(center.id);
    await participants.setParticipants(identity(center.id), draft.id, [
      students[0],
    ]);

    const modelltest = await prisma.modelltest.findUniqueOrThrow({
      where: { number: modelltestNumber },
      select: { id: true },
    });
    await prisma.studentActivity.create({
      data: {
        student_id: students[1],
        skill: 'LESEN',
        teil: 1,
        score: 80,
        max_score: 100,
        modelltest_id: modelltest.id,
        attempt_id: `exam-test-${Date.now()}`,
      },
    });

    const eligible = await participants.listEligible(
      identity(center.id),
      draft.id,
      { page: 1, pageSize: 50 },
    );

    expect(eligible.students).toHaveLength(3);
    expect(eligible.total).toBe(3);
    const byId = new Map(eligible.students.map((row) => [row.id, row]));
    expect(byId.get(students[0])).toMatchObject({
      selected: true,
      trainedOnModelltest: false,
    });
    expect(byId.get(students[1])).toMatchObject({
      selected: false,
      // The warning that stops a sitting being meaningless.
      trainedOnModelltest: true,
    });
  });

  it('shows no student of another center', async () => {
    const mine = await makeCenter(10);
    const theirs = await makeCenter(10);
    await makeStudents(theirs.id, 2);
    const draft = await makeDraft(mine.id);

    await expect(
      participants.listEligible(identity(mine.id), draft.id, {
        page: 1,
        pageSize: 50,
      }),
    ).resolves.toEqual({ students: [], total: 0 });
  });

  it('pages the picker and searches it, so a big school is usable', async () => {
    // A list endpoint without a page is a list endpoint that eventually
    // times out. Four hundred students is an ordinary school.
    const center = await makeCenter(10);
    await makeStudents(center.id, 5);
    const named = await prisma.student.create({
      data: {
        email: `exam-test-search-${Date.now()}@example.com`,
        center_id: center.id,
        first_name: 'Ngeleka',
      },
    });
    const draft = await makeDraft(center.id);

    const firstPage = await participants.listEligible(
      identity(center.id),
      draft.id,
      { page: 1, pageSize: 2 },
    );
    expect(firstPage.students).toHaveLength(2);
    expect(firstPage.total).toBe(6);

    const found = await participants.listEligible(
      identity(center.id),
      draft.id,
      { page: 1, pageSize: 50, search: 'ngel' },
    );
    expect(found.students.map((row) => row.id)).toEqual([named.id]);
  });
});
