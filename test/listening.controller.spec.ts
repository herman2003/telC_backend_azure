import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '../src/shared/guards/jwt-auth.guard';
import { StudentSubscriptionGuard } from '../src/shared/guards/student-subscription.guard';
import { PrepPassGuard } from '../src/shared/guards/prep-pass.guard';
import { ListeningController } from '../src/modules/listening/listening.controller';
import { ListeningService } from '../src/modules/listening/listening.service';
import { TrainingAudioService } from '../src/modules/listening/training-audio.service';

const MOCK_STUDENT = { studentId: 'student-abc', deviceId: 'dev-1' };

const mockListeningService = {
  getTeils: jest.fn(),
  getSessions: jest.fn(),
  getExercise: jest.fn(),
  submit: jest.fn(),
};

const mockTrainingAudio = {
  play: jest.fn(),
};

describe('ListeningController', () => {
  let controller: ListeningController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ListeningController],
      providers: [
        { provide: ListeningService, useValue: mockListeningService },
        { provide: TrainingAudioService, useValue: mockTrainingAudio },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      // This spec is about the controller delegating to its service. Whether a
      // subscription / Prep Pass is live is those guards' own specs to prove.
      .overrideGuard(StudentSubscriptionGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PrepPassGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ListeningController>(ListeningController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // GET teils
  // ---------------------------------------------------------------------------
  describe('getTeils', () => {
    it('delegates to service.getTeils with studentId and returns result', async () => {
      const teils = [{ id: '1', title: 'Teil 1', progress: 0 }];
      mockListeningService.getTeils.mockResolvedValue(teils);

      const result = await controller.getTeils(MOCK_STUDENT as any);

      expect(mockListeningService.getTeils).toHaveBeenCalledWith(
        'student-abc',
        1,
      );
      expect(result).toBe(teils);
    });

    it('returns [] when student is null', async () => {
      const result = await controller.getTeils(null as any);

      expect(mockListeningService.getTeils).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // GET sessions
  // ---------------------------------------------------------------------------
  describe('getSessions', () => {
    it('delegates to service.getSessions with studentId and parsed teilNumber', async () => {
      const sessions = [{ id: 'att-1', score: 80 }];
      mockListeningService.getSessions.mockResolvedValue(sessions);

      const result = await controller.getSessions(MOCK_STUDENT as any, '2');

      expect(mockListeningService.getSessions).toHaveBeenCalledWith(
        'student-abc',
        2,
      );
      expect(result).toBe(sessions);
    });

    it('passes undefined teilNumber when query param is absent', async () => {
      mockListeningService.getSessions.mockResolvedValue([]);

      await controller.getSessions(MOCK_STUDENT as any, undefined);

      expect(mockListeningService.getSessions).toHaveBeenCalledWith(
        'student-abc',
        undefined,
      );
    });

    it('returns [] when student is null', async () => {
      const result = await controller.getSessions(null as any, undefined);

      expect(mockListeningService.getSessions).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // GET exercise
  // ---------------------------------------------------------------------------
  describe('getExercise', () => {
    it('delegates to service.getExercise with type param and returns result', async () => {
      const payload = {
        audioId: 'a',
        playsAllowed: 1,
        contentRevision: 'v1',
        imagePath: '',
        questions: [],
      };
      mockListeningService.getExercise.mockResolvedValue(payload);

      const result = await controller.getExercise(MOCK_STUDENT as any, '1');

      expect(mockListeningService.getExercise).toHaveBeenCalledWith('1', 1);
      expect(result).toBe(payload);
    });
  });

  describe('playAudio', () => {
    it('delegates to TrainingAudioService.play', async () => {
      const granted = {
        audioId: '11111111-1111-4111-8111-111111111111',
        url: '/api/listening/audio?token=x',
        playsRemaining: 0,
        expiresAt: new Date(),
      };
      mockTrainingAudio.play.mockResolvedValue(granted);

      const result = await controller.playAudio(
        MOCK_STUDENT as any,
        '11111111-1111-4111-8111-111111111111',
      );

      expect(mockTrainingAudio.play).toHaveBeenCalledWith(
        'student-abc',
        '11111111-1111-4111-8111-111111111111',
        { isGuest: false },
      );
      expect(result).toBe(granted);
    });

    it('passes isGuest through for demo tokens', async () => {
      mockTrainingAudio.play.mockResolvedValue({
        audioId: '11111111-1111-4111-8111-111111111111',
        url: '/api/listening/audio?token=x',
        playsRemaining: 0,
        expiresAt: new Date(),
      });

      await controller.playAudio(
        { studentId: 'guest-1', deviceId: 'guest', isGuest: true } as never,
        '11111111-1111-4111-8111-111111111111',
      );

      expect(mockTrainingAudio.play).toHaveBeenCalledWith(
        'guest-1',
        '11111111-1111-4111-8111-111111111111',
        { isGuest: true },
      );
    });
  });

  // ---------------------------------------------------------------------------
  // POST submit
  // ---------------------------------------------------------------------------
  describe('submit', () => {
    const dto = {
      type: '1',
      timed: true,
      content_revision: 'modelltest-1-teil-1-v1',
      answers: { q41: '-' },
    };

    it('delegates to service.submit with studentId and dto, returns result', async () => {
      const response = { score: 100 };
      mockListeningService.submit.mockResolvedValue(response);

      const result = await controller.submit(MOCK_STUDENT as any, dto as any);

      expect(mockListeningService.submit).toHaveBeenCalledWith(
        'student-abc',
        dto,
      );
      expect(result).toBe(response);
    });

    it('throws UnauthorizedException when student is null', async () => {
      await expect(controller.submit(null as any, dto as any)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockListeningService.submit).not.toHaveBeenCalled();
    });
  });
});
