/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { CenterSubscriptionController } from '../src/modules/centers/center-subscription.controller';
import { CenterSubscriptionService } from '../src/modules/centers/center-subscription.service';
import { CenterTrialService } from '../src/modules/centers/center-trial.service';
import { CenterAuthGuard } from '../src/modules/centers/guards/center-auth.guard';
import { createGlobalValidationPipe } from '../src/shared/pipes/global-validation.pipe';

const signedIdentity = {
  type: 'access',
  actorType: 'CENTER_USER',
  centerUserId: 'owner-1',
  centerId: 'center-1',
  deviceId: 'browser-1',
  sessionId: 'center-session-1',
};

const A_QUOTE = { seats: 10, unitPriceXaf: 4500, totalXaf: 45000 };

describe('POST /api/centers/me/subscription/quote', () => {
  let app: INestApplication<App>;
  let subscriptions: { quote: jest.Mock };

  beforeEach(async () => {
    subscriptions = { quote: jest.fn().mockResolvedValue(A_QUOTE) };

    const module = await Test.createTestingModule({
      controllers: [CenterSubscriptionController],
      providers: [
        // Not under test here; the controller only needs it to be resolvable.
        { provide: CenterTrialService, useValue: { start: jest.fn() } },
        { provide: CenterSubscriptionService, useValue: subscriptions },
      ],
    })
      .overrideGuard(CenterAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          context.switchToHttp().getRequest().centerUser = signedIdentity;
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(createGlobalValidationPipe());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  const http = () => request(app.getHttpServer());
  const quote = (body: unknown) =>
    http()
      .post('/api/centers/me/subscription/quote')
      .send(body as object);

  it('quotes a seat count', async () => {
    const response = await quote({ seats: 10 }).expect(201);

    expect(response.body).toEqual(A_QUOTE);
  });

  it('passes the seat count the body carries', async () => {
    await quote({ seats: 12 });

    expect(subscriptions.quote).toHaveBeenCalledWith(signedIdentity, 12);
  });

  it('prices the caller own center, never one named in the body', async () => {
    await quote({ seats: 10 });

    expect(subscriptions.quote).toHaveBeenCalledWith(
      signedIdentity,
      expect.anything(),
    );
  });

  /**
   * The security property of the whole phase.
   *
   * These are not ignored, they are refused. Silently dropping an unexpected
   * `amount` would leave a client believing it had set the price, and leave
   * anyone reading the code unsure whether it had.
   */
  describe('the client cannot influence the price', () => {
    it.each([
      ['a unit price', { seats: 10, unitPriceXaf: 1 }],
      ['a total', { seats: 10, amountXaf: 1 }],
      ['an amount', { seats: 10, amount: 1 }],
      ['a total under another name', { seats: 10, total: 1 }],
      ['a currency', { seats: 10, currency: 'EUR' }],
      ['another center', { seats: 10, centerId: 'someone-else' }],
      ['a tier, which no longer exists', { start: 5, pro: 5 }],
    ])('refuses %s', async (_case, body) => {
      const response = await quote(body).expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(subscriptions.quote).not.toHaveBeenCalled();
    });
  });

  describe('the seat count must be a seat count', () => {
    it.each([
      ['a string', { seats: '10' }],
      ['a fraction', { seats: 10.5 }],
      ['a negative', { seats: -10 }],
      ['zero, which buys nothing', { seats: 0 }],
      ['an absurd number', { seats: 20000 }],
      ['nothing at all', {}],
    ])('refuses %s', async (_case, body) => {
      await quote(body).expect(400);
      expect(subscriptions.quote).not.toHaveBeenCalled();
    });
  });
});
