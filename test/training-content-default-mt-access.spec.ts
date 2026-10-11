import { ForbiddenException } from '@nestjs/common';
import { LesenController } from '../src/modules/lesen/lesen.controller';
import { SprachbausteineController } from '../src/modules/sprachbausteine/sprachbausteine.controller';
import { ListeningController } from '../src/modules/listening/listening.controller';

/**
 * Regression: PrepPassGuard allows requests with no modelltest, but content
 * handlers default to MT 1. Start must still be checked against that default.
 */
describe('training content defaults assert weekly-or-Prep-Pass', () => {
  const access = { assertMayAccess: jest.fn() };
  const student = { studentId: 's1', isGuest: false } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    access.assertMayAccess.mockResolvedValue(undefined);
  });

  it('Lesen getExercise without modelltest asserts access for MT 1', async () => {
    const lesenService = { getExercise: jest.fn().mockResolvedValue({}) };
    const controller = new LesenController(
      lesenService as never,
      access as never,
    );

    await controller.getExercise(student);

    expect(access.assertMayAccess).toHaveBeenCalledWith('s1', 1);
    expect(lesenService.getExercise).toHaveBeenCalledWith(1);
  });

  it('Lesen getExercise refuses when assertMayAccess rejects the default', async () => {
    access.assertMayAccess.mockRejectedValue(
      new ForbiddenException({
        message: 'PREP_PASS_REQUIRED',
        messageKey: 'prepPassRequired',
        reason: 'NOT_HELD',
      }),
    );
    const lesenService = { getExercise: jest.fn() };
    const controller = new LesenController(
      lesenService as never,
      access as never,
    );

    await expect(controller.getExercise(student)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(lesenService.getExercise).not.toHaveBeenCalled();
  });

  it('Sprachbausteine getExercise without modelltest asserts access for MT 1', async () => {
    const service = { getExercise: jest.fn().mockResolvedValue({}) };
    const controller = new SprachbausteineController(
      service as never,
      access as never,
    );

    await controller.getExercise(student);

    expect(access.assertMayAccess).toHaveBeenCalledWith('s1', 1);
  });

  it('Listening getExercise without modelltest asserts access for MT 1', async () => {
    const listeningService = {
      getExercise: jest.fn().mockResolvedValue({}),
    };
    const trainingAudio = { play: jest.fn() };
    const controller = new ListeningController(
      listeningService as never,
      trainingAudio as never,
      access as never,
    );

    await controller.getExercise(student, undefined, '1', undefined);

    expect(access.assertMayAccess).toHaveBeenCalledWith('s1', 1);
  });

  it('skips assertMayAccess for guests', async () => {
    const lesenService = { getExercise: jest.fn().mockResolvedValue({}) };
    const controller = new LesenController(
      lesenService as never,
      access as never,
    );

    await controller.getExercise({ studentId: 'g1', isGuest: true } as never);

    expect(access.assertMayAccess).not.toHaveBeenCalled();
  });
});
