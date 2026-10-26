import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpCode,
  HttpStatus,
  Ip,
  Logger,
  NotFoundException,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import type { CefrLevel } from '@prisma/client';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { AccessTokenPayload } from '../../../shared/interfaces/token-payload.interface';
import { PrismaService } from '../../../shared/services/prisma.service';
import { SpeakingService } from '../services/speaking.service';
import { GeminiService } from '../services/gemini.service';
import {
  findSpeakingTopicById,
  listElenaTopics,
  type SpeakingTopic,
} from '../room/speaking-topics.data';
import {
  ExaminerPromptService,
  ExaminerTopic,
} from './examiner-prompt.service';
import {
  LiveSessionCaller,
  LiveSessionLimitService,
} from './live-session-limit.service';
import { AiUsageService } from '../../../shared/services/ai-usage.service';
import {
  EntitlementSpendService,
  type EntitlementDecision,
  type EntitlementSpendOptions,
} from '../../../shared/services/entitlement-spend.service';
import { CreateLiveTokenDto } from './dto/create-live-token.dto';
import { ElenaTopicDto } from './dto/elena-topic.dto';
import { EndLiveSessionDto } from './dto/end-live-session.dto';
import { LiveTokenResponseDto } from './dto/live-token-response.dto';

/**
 * What a student is told when they have run out, and why each is different.
 *
 * A frozen centre has not run out of anything — the credits are sitting there
 * waiting to be paid for — and telling the student they are out would be both
 * wrong and something they cannot act on.
 */
const ELENA_REFUSALS: Record<string, { key: string; message: string }> = {
  FROZEN: {
    key: 'elenaCenterUnpaid',
    message:
      'Votre centre doit régler son abonnement pour que vos sessions reprennent.',
  },
  NO_CAP: {
    key: 'elenaNoAllowance',
    message:
      'Vous avez utilisé vos sessions du mois. Demandez des crédits à votre centre.',
  },
  CAP_REACHED: {
    key: 'elenaNoAllowance',
    message:
      'Vous avez utilisé vos sessions du mois. Demandez des crédits à votre centre.',
  },
  POOL_EMPTY: {
    key: 'elenaMonthlyLimit',
    message: 'Vous avez utilisé vos sessions du mois. Elles reviennent le 1er.',
  },
  NO_ACCOUNT: {
    key: 'elenaRequiresAccount',
    message: 'Créez un compte pour parler avec Elena.',
  },
  NO_CODE: {
    key: 'elenaNoAllowance',
    message:
      'Vous avez utilisé vos sessions du mois. Demandez des crédits à votre centre.',
  },
};

type ResolvedSession = {
  teilNumber: number;
  topic: ExaminerTopic | null;
  spendOpts: EntitlementSpendOptions;
  catalogueTopicId?: string;
};

/**
 * Issues the credential for a live spoken session with Elena.
 *
 * Deliberately NOT behind GuestBlockGuard. The demo has no login — the Flutter
 * app mints a guest JWT from POST /api/auth/guest on first load — so blocking
 * guests here would block every real user. Spend is controlled by
 * {@link LiveSessionLimitService} instead, which caps guests by IP because a
 * guest studentId can be re-rolled at will.
 */
@ApiTags('Speaking')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
@UseGuards(JwtAuthGuard)
@Controller('api/speaking')
export class LiveTokenController {
  private readonly logger = new Logger(LiveTokenController.name);

  constructor(
    private readonly speakingService: SpeakingService,
    private readonly geminiService: GeminiService,
    private readonly promptService: ExaminerPromptService,
    private readonly limitService: LiveSessionLimitService,
    private readonly entitlements: EntitlementSpendService,
    private readonly usage: AiUsageService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('elena-topics')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Catalogue topics for Mit Elena (credits)',
    description:
      'Themen for the authenticated student’s CEFR level only. ' +
      'A1/A2 may be empty until catalogue topics exist — use the weekly ' +
      'Modelltest path (teilNumber) instead. Pass one id as topicId to ' +
      'POST /api/speaking/live-token.',
  })
  @ApiOkResponse({ type: [ElenaTopicDto] })
  async listElenaTopics(
    @Request() req: { student?: AccessTokenPayload },
  ): Promise<ElenaTopicDto[]> {
    const level = await this.studentLevel(req.student);
    if (level == null) return [];
    return listElenaTopics(level);
  }

  @Post('live-token')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Mint an ephemeral token for a live session with Elena',
    description:
      'Exam path: teilNumber (+ modelltest). Mit Elena path: topicId from ' +
      'GET /elena-topics (credits only). Browser connects directly to Google; ' +
      'no audio through this backend. Guests capped per IP.',
  })
  @ApiCreatedResponse({ type: LiveTokenResponseDto })
  @ApiTooManyRequestsResponse({
    description:
      'A cap was hit. messageKey is one of elenaDailyLimit, elenaBusyToday, ' +
      'elenaBusyNow, elenaSessionAlreadyOpen — each maps to a different ' +
      'message and all offer the human room. elenaSessionAlreadyOpen means ' +
      'this student already has Elena open: end that one first. It costs ' +
      'them nothing.',
  })
  async createLiveToken(
    @Ip() ip: string,
    @Request() req: { student?: AccessTokenPayload },
    @Body() dto: CreateLiveTokenDto,
  ): Promise<LiveTokenResponseDto> {
    const session = await this.resolveSession(dto, req.student);
    const sessionId = randomUUID();
    const caller = this.callerOf(ip, req);

    const decision = caller.isGuest
      ? null
      : await this.requireAllowance(caller, session.spendOpts);

    await this.limitService.acquire(caller, sessionId);

    const instruction = this.promptService.build(
      session.teilNumber,
      session.topic,
    );
    const sessionSeconds = this.limitService.sessionSeconds;

    const { token, model } = await this.geminiService.mintLiveToken(
      instruction,
      sessionSeconds,
    );

    if (decision && req.student?.studentId) {
      const source = await this.entitlements.spend(
        req.student.studentId,
        'AI_SPEAKING_CREDIT',
        new Date(),
        session.spendOpts,
      );
      await this.usage.recordDelivered(
        req.student.studentId,
        'SPEAKING_LIVE_SESSION',
        {
          teilNumber: session.teilNumber,
          countsTowardFree: source === 'FREE',
        },
      );
    }

    this.logger.log(
      JSON.stringify({
        event: 'elena.token.minted',
        sessionId,
        teil: session.teilNumber,
        model,
        hasTopic: session.topic !== null,
        catalogueTopicId: session.catalogueTopicId ?? null,
      }),
    );

    return {
      sessionId,
      token,
      model,
      expiresInSeconds: sessionSeconds,
      teilNumber: session.teilNumber,
      ...(session.topic ? { topic: session.topic } : {}),
    };
  }

  @Post('live-session/end')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Release a live session slot early',
    description:
      'Call when the conversation ends. The pool of concurrent sessions is ' +
      'otherwise TTL-driven — the backend never learns that a ' +
      'browser-to-Google session finished — so a two-minute conversation ' +
      'would hold a slot for the full session ceiling and keep others out, ' +
      'including the student themselves, who may only have one open at a ' +
      'time. ' +
      'Idempotent, and always 204: an unknown or already-released id is not ' +
      'reported, so this cannot be used to probe which sessions exist.',
  })
  @ApiNoContentResponse({ description: 'Slot released, or was not held' })
  async endLiveSession(
    @Ip() ip: string,
    @Request() req: { student?: AccessTokenPayload },
    @Body() dto: EndLiveSessionDto,
  ): Promise<void> {
    await this.limitService.release(dto.sessionId, this.callerOf(ip, req));
  }

  private async resolveSession(
    dto: CreateLiveTokenDto,
    student?: AccessTokenPayload,
  ): Promise<ResolvedSession> {
    const hasTeil = dto.teilNumber != null;
    const hasTopic = dto.topicId != null && dto.topicId.trim() !== '';

    if (hasTeil === hasTopic) {
      throw new BadRequestException('LIVE_TOKEN_CHOOSE_TEIL_OR_TOPIC');
    }

    if (hasTopic) {
      const catalogue = findSpeakingTopicById(dto.topicId!.trim());
      if (!catalogue) {
        throw new NotFoundException('ELENA_TOPIC_NOT_FOUND');
      }
      const level = await this.studentLevel(student);
      if (level == null || catalogue.level !== level) {
        throw new NotFoundException('ELENA_TOPIC_NOT_FOUND');
      }
      return {
        teilNumber: catalogue.teil,
        topic: this.catalogueAsExaminerTopic(catalogue),
        catalogueTopicId: catalogue.id,
        spendOpts: { teilNumber: catalogue.teil, allowFree: false },
      };
    }

    const teilNumber = dto.teilNumber!;
    const topic = await this.loadTopic(teilNumber, dto.modelltest ?? 1);
    return {
      teilNumber,
      topic,
      spendOpts: { teilNumber, allowFree: true },
    };
  }

  /** Guests and missing rows have no CEFR — catalogue stays empty. */
  private async studentLevel(
    student?: AccessTokenPayload,
  ): Promise<CefrLevel | null> {
    if (!student?.studentId || student.isGuest === true) return null;
    const row = await this.prisma.student.findUnique({
      where: { id: student.studentId },
      select: { level: true },
    });
    return row?.level ?? null;
  }

  private catalogueAsExaminerTopic(topic: SpeakingTopic): ExaminerTopic {
    return {
      title: topic.title,
      description: `${topic.positionA} ${topic.positionB}`.trim(),
      points: topic.followUpQuestions,
    };
  }

  private async requireAllowance(
    caller: LiveSessionCaller,
    spendOpts: EntitlementSpendOptions,
  ): Promise<EntitlementDecision> {
    const decision = await this.entitlements.mayUse(
      caller.studentId!,
      'AI_SPEAKING_CREDIT',
      new Date(),
      spendOpts,
    );
    if (decision.allowed) return decision;

    const refusal = ELENA_REFUSALS[decision.reason ?? 'POOL_EMPTY'];
    throw new HttpException(
      { messageKey: refusal.key, message: refusal.message },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private callerOf(
    ip: string,
    req: { student?: AccessTokenPayload },
  ): LiveSessionCaller {
    return {
      ip: ip || 'unknown',
      studentId: req.student?.studentId,
      isGuest: req.student?.isGuest === true,
    };
  }

  /**
   * A missing or unseeded Modelltest must not stop someone practising: Elena's
   * base persona already tells her to introduce a topic herself. So a lookup
   * failure is logged and downgraded to "no topic", never surfaced as an error.
   *
   * Resolves B1/B2 `speaking_exercises` and A1/A2 generic SPRECHEN sections.
   */
  private async loadTopic(
    teilNumber: number,
    modelltest: number,
  ): Promise<ExaminerTopic | null> {
    try {
      return await this.speakingService.resolveExaminerTopic(
        modelltest,
        teilNumber,
      );
    } catch (error) {
      this.logger.warn(
        `No topic for Teil ${teilNumber} of Modelltest ${modelltest}: ` +
          `${(error as Error).message}. Continuing without one.`,
      );
      return null;
    }
  }
}
