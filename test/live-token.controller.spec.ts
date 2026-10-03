import { AccessTokenPayload } from '../src/shared/interfaces/token-payload.interface';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { LiveTokenController } from '../src/modules/speaking/live/live-token.controller';
import { ExaminerPromptService } from '../src/modules/speaking/live/examiner-prompt.service';
import { LiveSessionLimitService } from '../src/modules/speaking/live/live-session-limit.service';
import { EntitlementSpendService } from '../src/shared/services/entitlement-spend.service';
import { AiUsageService } from '../src/shared/services/ai-usage.service';
import { SpeakingService } from '../src/modules/speaking/services/speaking.service';
import { GeminiService } from '../src/modules/speaking/services/gemini.service';
import { JwtAuthGuard } from '../src/shared/guards/jwt-auth.guard';

const TEIL_2 = {
  id: 2,
  part: 2,
  title: 'Teil 2',
  subtitle: '',
  topicTitle: 'Arbeit und Freizeit',
  topicDescription: 'Sprechen Sie über Ihre Arbeit.',
  topicPoints: ['Ihr Arbeitstag'],
  durationMinutes: 6,
  prepDurationSeconds: 60,
  imagePath: '',
  examImagePath: null,
};

const mockSpeakingService = { getTeils: jest.fn() };
const mockGeminiService = { mintLiveToken: jest.fn() };
const mockPromptService = { build: jest.fn() };
const mockLimitService = {
  acquire: jest.fn(),
  release: jest.fn(),
  sessionSeconds: 600,
};

const mockEntitlements = {
  mayUse: jest.fn(),
  spend: jest.fn(),
};
const mockUsage = { recordDelivered: jest.fn() };

/** Allowed, with free sessions still in hand. */
const freeSessionsLeft = {
  allowed: true,
  reason: null,
  freeRemaining: 3,
  creditsAvailable: 0,
  resetsAt: new Date('2026-11-01'),
  expiresAt: null,
};

const guestReq = {
  student: {
    type: 'access',
    studentId: 'guest-uuid',
    deviceId: 'guest-device',
    isGuest: true,
  },
} satisfies { student: AccessTokenPayload };

const studentReq = {
  student: {
    type: 'access',
    studentId: 'student-1',
    deviceId: 'device-1',
    isGuest: false,
  },
} satisfies { student: AccessTokenPayload };

describe('LiveTokenController', () => {
  let controller: LiveTokenController;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSpeakingService.getTeils.mockResolvedValue([TEIL_2]);
    mockPromptService.build.mockReturnValue('SYSTEM INSTRUCTION');
    mockGeminiService.mintLiveToken.mockResolvedValue({
      token: 'auth_tokens/xyz',
      model: 'gemini-live-2.5-flash-preview',
    });
    mockLimitService.acquire.mockResolvedValue(undefined);
    mockEntitlements.mayUse.mockResolvedValue(freeSessionsLeft);
    mockEntitlements.spend.mockResolvedValue(undefined);
    mockUsage.recordDelivered.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LiveTokenController],
      providers: [
        { provide: SpeakingService, useValue: mockSpeakingService },
        { provide: GeminiService, useValue: mockGeminiService },
        { provide: ExaminerPromptService, useValue: mockPromptService },
        { provide: LiveSessionLimitService, useValue: mockLimitService },
        { provide: EntitlementSpendService, useValue: mockEntitlements },
        { provide: AiUsageService, useValue: mockUsage },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<LiveTokenController>(LiveTokenController);
  });

  it('returns the token, model, ceiling and topic', async () => {
    const result = await controller.createLiveToken('1.2.3.4', guestReq, {
      teilNumber: 2,
    });

    expect(result).toEqual({
      sessionId: expect.any(String),
      token: 'auth_tokens/xyz',
      model: 'gemini-live-2.5-flash-preview',
      expiresInSeconds: 600,
      teilNumber: 2,
      topic: {
        title: 'Arbeit und Freizeit',
        description: 'Sprechen Sie über Ihre Arbeit.',
        points: ['Ihr Arbeitstag'],
      },
    });
  });

  it('serves guest accounts', async () => {
    // The demo has no login — every real user arrives on a guest JWT. If this
    // ever starts refusing guests, the whole feature is dead in production.
    await expect(
      controller.createLiveToken('1.2.3.4', guestReq, { teilNumber: 1 }),
    ).resolves.toHaveProperty('token');
  });

  it('passes the caller identity to the limiter, flagged as guest', async () => {
    await controller.createLiveToken('5.6.7.8', guestReq, { teilNumber: 1 });

    expect(mockLimitService.acquire).toHaveBeenCalledWith(
      { ip: '5.6.7.8', studentId: 'guest-uuid', isGuest: true },
      expect.any(String),
    );
  });

  it('never lets the client choose the instruction', async () => {
    await controller.createLiveToken('1.2.3.4', guestReq, { teilNumber: 3 });

    // The instruction is built server-side from the Teil and the seeded topic.
    expect(mockPromptService.build).toHaveBeenCalledWith(3, expect.any(Object));
    expect(mockGeminiService.mintLiveToken).toHaveBeenCalledWith(
      'SYSTEM INSTRUCTION',
      600,
    );
  });

  it('still mints a token when the Modelltest has no speaking exercise', async () => {
    mockSpeakingService.getTeils.mockRejectedValue(
      new NotFoundException('Modelltest 9 not found'),
    );

    const result = await controller.createLiveToken('1.2.3.4', guestReq, {
      teilNumber: 2,
      modelltest: 9,
    });

    expect(result.token).toBe('auth_tokens/xyz');
    expect(result.topic).toBeUndefined();
    expect(mockPromptService.build).toHaveBeenCalledWith(2, null);
  });

  it('omits the topic when the Teil is not among the seeded exercises', async () => {
    mockSpeakingService.getTeils.mockResolvedValue([TEIL_2]);

    const result = await controller.createLiveToken('1.2.3.4', guestReq, {
      teilNumber: 1,
    });

    expect(result.topic).toBeUndefined();
  });

  describe('what a registered student is allowed', () => {
    it('checks the allowance before minting anything', async () => {
      await controller.createLiveToken('1.2.3.4', studentReq, {
        teilNumber: 1,
      });

      expect(mockEntitlements.mayUse).toHaveBeenCalledWith(
        'student-1',
        'AI_SPEAKING_CREDIT',
      );
    });

    it('mints nothing when they have neither a free session nor a credit', async () => {
      mockEntitlements.mayUse.mockResolvedValue({
        allowed: false,
        reason: 'CAP_REACHED',
        freeRemaining: 0,
        creditsAvailable: 0,
        resetsAt: new Date(),
        expiresAt: null,
      });

      await expect(
        controller.createLiveToken('1.2.3.4', studentReq, { teilNumber: 1 }),
      ).rejects.toThrow(HttpException);

      expect(mockGeminiService.mintLiveToken).not.toHaveBeenCalled();
      expect(mockLimitService.acquire).not.toHaveBeenCalled();
    });

    it('says a lapsed centre is a lapsed centre, not an empty allowance', async () => {
      // The student has not run out of anything — their credits are sitting
      // there waiting to be paid for. Telling them they are out would be both
      // wrong and something they cannot act on.
      mockEntitlements.mayUse.mockResolvedValue({
        allowed: false,
        reason: 'FROZEN',
        freeRemaining: 0,
        creditsAvailable: 0,
        resetsAt: null,
        expiresAt: null,
      });

      const refusal = await controller
        .createLiveToken('1.2.3.4', studentReq, { teilNumber: 1 })
        .catch((error: HttpException) => error.getResponse());

      expect(refusal).toMatchObject({ messageKey: 'elenaCenterUnpaid' });
    });

    it('records the session only after the token exists', async () => {
      // A failure on our side must not cost a student a session they never
      // had, which is the same rule the AI quota follows.
      const order: string[] = [];
      mockGeminiService.mintLiveToken.mockImplementation(() => {
        order.push('mint');
        return Promise.resolve({ token: 't', model: 'm' });
      });
      mockUsage.recordDelivered.mockImplementation(() => {
        order.push('record');
        return Promise.resolve(undefined);
      });

      await controller.createLiveToken('1.2.3.4', studentReq, {
        teilNumber: 1,
      });

      expect(order).toEqual(['mint', 'record']);
    });

    it('spends before recording, so the row does not pay for itself', async () => {
      // `spend` is a no-op while free sessions remain, and it decides that by
      // counting the rows. Recording first would make every session look free.
      const order: string[] = [];
      mockEntitlements.spend.mockImplementation(() => {
        order.push('spend');
        return Promise.resolve(undefined);
      });
      mockUsage.recordDelivered.mockImplementation(() => {
        order.push('record');
        return Promise.resolve(undefined);
      });

      await controller.createLiveToken('1.2.3.4', studentReq, {
        teilNumber: 1,
      });

      expect(order).toEqual(['spend', 'record']);
    });

    it('leaves guests out of it entirely', async () => {
      // A guest has no account to charge and no allowance to check. They are
      // bounded by IP inside the limit service, as they were before.
      await controller.createLiveToken('1.2.3.4', guestReq, { teilNumber: 1 });

      expect(mockEntitlements.mayUse).not.toHaveBeenCalled();
      expect(mockEntitlements.spend).not.toHaveBeenCalled();
      expect(mockUsage.recordDelivered).not.toHaveBeenCalled();
    });
  });

  describe('endLiveSession', () => {
    it('releases the slot the client was given', async () => {
      const minted = await controller.createLiveToken('1.2.3.4', guestReq, {
        teilNumber: 2,
      });

      await controller.endLiveSession('1.2.3.4', guestReq, {
        sessionId: minted.sessionId,
      });

      expect(mockLimitService.release).toHaveBeenCalledWith(
        minted.sessionId,
        expect.objectContaining({ isGuest: true }),
      );
    });

    it('says who is ending it, so their own live slot is freed too', async () => {
      // Releasing the shared pool and leaving the student's own place taken
      // would lock them out of the session they just made room for.
      const minted = await controller.createLiveToken('1.2.3.4', studentReq, {
        teilNumber: 1,
      });

      await controller.endLiveSession('1.2.3.4', studentReq, {
        sessionId: minted.sessionId,
      });

      expect(mockLimitService.release).toHaveBeenCalledWith(
        minted.sessionId,
        expect.objectContaining({ studentId: 'student-1', isGuest: false }),
      );
    });

    it('returns the same sessionId it reserved the slot under', async () => {
      // The client can only free the slot if these two match.
      const minted = await controller.createLiveToken('1.2.3.4', guestReq, {
        teilNumber: 1,
      });

      const reservedUnder = mockLimitService.acquire.mock.calls[0][1] as string;
      expect(minted.sessionId).toBe(reservedUnder);
    });
  });

  it('does not mint anything when a cap refuses the request', async () => {
    mockLimitService.acquire.mockRejectedValue(
      new HttpException(
        { messageKey: 'elenaDailyLimit' },
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );

    await expect(
      controller.createLiveToken('1.2.3.4', guestReq, { teilNumber: 2 }),
    ).rejects.toThrow(HttpException);

    expect(mockGeminiService.mintLiveToken).not.toHaveBeenCalled();
  });
});
