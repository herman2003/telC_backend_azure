import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import type {
  ModelltestDetailDto,
  ModelltestListItemDto,
  ModelltestOfTheWeekDto,
} from './dto/modelltest.dto';
import { getSevenDayPeriod } from './seven-day-period';
import {
  assertGuestMayAccessModelltest,
  guestMayAccessModelltest,
} from '../../shared/guest-modelltest-access';

@Injectable()
export class ModelltestsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(opts: { isGuest?: boolean } = {}): Promise<ModelltestListItemDto[]> {
    const rows = await this.prisma.modelltest.findMany({
      // Exam material is kept out of the training catalogue, so a sitting can
      // use a Modelltest no student has worked through. Everything that
      // exists today is false; this is what makes the flag mean something.
      where: { exam_only: false },
      orderBy: { number: 'asc' },
    });
    const visible =
      opts.isGuest === true
        ? rows.filter((row) => guestMayAccessModelltest(row.number))
        : rows;
    return visible.map(({ id, number, title }) => ({ id, number, title }));
  }

  /**
   * Training Modelltest for the current 7-day UTC window. Start-only surface;
   * does not expose Prep Pass exercise IDs.
   */
  async getOfTheWeek(
    now: Date = new Date(),
    opts: { isGuest?: boolean } = {},
  ): Promise<ModelltestOfTheWeekDto> {
    const rows = await this.prisma.modelltest.findMany({
      where: { exam_only: false },
      orderBy: { number: 'asc' },
      select: { id: true, number: true, title: true },
    });
    const pool =
      opts.isGuest === true
        ? rows.filter((row) => guestMayAccessModelltest(row.number))
        : rows;

    if (pool.length === 0) {
      throw new NotFoundException('No training Modelltest available');
    }

    const { periodIndex, periodStart, periodEnd } = getSevenDayPeriod(now);
    // Adding a new training MT changes N and therefore the index — expected.
    const row = pool[periodIndex % pool.length];

    return {
      id: row.id,
      number: row.number,
      title: row.title,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    };
  }

  async getByNumber(
    number: number,
    opts: { isGuest?: boolean } = {},
  ): Promise<ModelltestDetailDto> {
    assertGuestMayAccessModelltest(opts.isGuest, number);

    const row = await this.prisma.modelltest.findFirst({
      // Same reason as getAll: a student must not reach exam material by
      // asking for it by number.
      where: { number, exam_only: false },
      include: {
        sprachbausteineExercises: { select: { id: true } },
        sprachbausteineTeil2Exercises: { select: { id: true } },
        lesenTeil1Exercises: { select: { id: true } },
        lesenTeil2Exercises: { select: { id: true } },
        lesenTeil3Exercises: { select: { id: true } },
        writingExercises: { select: { id: true } },
        listeningExercises: { select: { id: true } },
        speakingExercises: { select: { id: true } },
      },
    });

    if (!row) {
      throw new NotFoundException('Modelltest not found');
    }

    return {
      id: row.id,
      number: row.number,
      title: row.title,
      exercises: {
        sprachbausteineT1: row.sprachbausteineExercises.map((e) => e.id),
        sprachbausteineT2: row.sprachbausteineTeil2Exercises.map((e) => e.id),
        lesenT1: row.lesenTeil1Exercises.map((e) => e.id),
        lesenT2: row.lesenTeil2Exercises.map((e) => e.id),
        lesenT3: row.lesenTeil3Exercises.map((e) => e.id),
        writing: row.writingExercises.map((e) => e.id),
        listening: row.listeningExercises.map((e) => e.id),
        speaking: row.speakingExercises.map((e) => e.id),
      },
    };
  }
}
