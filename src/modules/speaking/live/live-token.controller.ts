import {
  Body,
  Controller,
  HttpException,
  HttpCode,
  HttpStatus,
  Ip,
  Logger,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { AccessTokenPayload } from '../../../shared/interfaces/token-payload.interface';
import { SpeakingService } from '../services/speaking.service';
import { GeminiService } from '../services/gemini.service';
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
} from '../../../shared/services/entitlement-spend.service';
import { CreateLiveTokenDto } from './dto/create-live-token.dto';
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
  ) {}

  @Post('live-token')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Mint an ephemeral token for a live session with Elena',
    description:
      'Returns a single-use Gemini token locked to the live model, audio-only ' +
      'output and the Teil system instruction. The browser connects directly ' +
      'to Google with it; no audio passes through this backend. Available to ' +
      'guest accounts, capped per IP per day.',
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
    const sessionId = randomUUID();
    const caller = this.callerOf(ip, req);

    // What Start sells, before what we can afford. A registered student gets
    // five conversations a month and then draws on the credits their centre
    // bought; a guest has no allowance and is metered by IP inside the limit
    // service instead.
    const decision = caller.isGuest
      ? null
      : await this.requireAllowance(caller);

    await this.limitService.acquire(caller, sessionId);

    const topic = await this.loadTopic(dto.teilNumber, dto.modelltest ?? 1);
    const instruction = this.promptService.build(dto.teilNumber, topic);
    const sessionSeconds = this.limitService.sessionSeconds;

    const { token, model } = await this.geminiService.mintLiveToken(
      instruction,
      sessionSeconds,
    );

    // After the token exists, never before. A failure on our side must not
    // cost a student a session they never had — the same rule the AI quota
    // follows for the same reason. `spend` is a no-op while free sessions
    // remain, so the row below is what the allowance is counted from either
    // way.
    if (decision && req.student?.studentId) {
      await this.entitlements.spend(
        req.student.studentId,
        'AI_SPEAKING_CREDIT',
      );
      await this.usage.recordDelivered(
        req.student.studentId,
        'SPEAKING_LIVE_SESSION',
      );
    }

    this.logger.log(
      JSON.stringify({
        event: 'elena.token.minted',
        sessionId,
        teil: dto.teilNumber,
        model,
        hasTopic: topic !== null,
      }),
    );

    return {
      sessionId,
      token,
      model,
      expiresInSeconds: sessionSeconds,
      teilNumber: dto.teilNumber,
      ...(topic ? { topic } : {}),
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
    // Who is ending it, not only which session. A student holds a live slot of
    // their own beside the shared one, and freeing the pool while leaving that
    // taken would lock them out of the session they just made room for.
    await this.limitService.release(dto.sessionId, this.callerOf(ip, req));
  }

  /**
   * Refuses a student who has neither a free session left nor a credit to
   * spend, saying which of the two it is.
   *
   * Four different situations, four messages. "Your centre stopped paying" and
   * "your centre has not given you any" and "you have used everything you were
   * given" are not the same sentence, and only some of them are something the
   * student can act on.
   */
  private async requireAllowance(
    caller: LiveSessionCaller,
  ): Promise<EntitlementDecision> {
    const decision = await this.entitlements.mayUse(
      caller.studentId!,
      'AI_SPEAKING_CREDIT',
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
   */
  private async loadTopic(
    teilNumber: number,
    modelltest: number,
  ): Promise<ExaminerTopic | null> {
    try {
      const teils = await this.speakingService.getTeils(modelltest);
      const match = teils.find((teil) => teil.part === teilNumber);
      if (!match) return null;

      return {
        title: match.topicTitle,
        description: match.topicDescription,
        points: match.topicPoints,
      };
    } catch (error) {
      this.logger.warn(
        `No topic for Teil ${teilNumber} of Modelltest ${modelltest}: ` +
          `${(error as Error).message}. Continuing without one.`,
      );
      return null;
    }
  }
}
