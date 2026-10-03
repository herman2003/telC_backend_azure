import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import type {
  ModelltestDetailDto,
  ModelltestListItemDto,
} from './dto/modelltest.dto';

@Injectable()
export class ModelltestsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(): Promise<ModelltestListItemDto[]> {
    const rows = await this.prisma.modelltest.findMany({
      // Exam material is kept out of the training catalogue, so a sitting can
      // use a Modelltest no student has worked through. Everything that
      // exists today is false; this is what makes the flag mean something.
      where: { exam_only: false },
      orderBy: { number: 'asc' },
    });
    return rows.map(({ id, number, title }) => ({ id, number, title }));
  }

  async getByNumber(number: number): Promise<ModelltestDetailDto> {
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
