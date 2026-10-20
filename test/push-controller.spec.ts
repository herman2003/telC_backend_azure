import type { Server } from 'http';
import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import request from 'supertest';
import { PushController } from '../src/modules/notifications/push/push.controller';
import { PushService } from '../src/modules/notifications/push/push.service';
import { FirebasePushService } from '../src/modules/notifications/push/firebase-push.service';
import { JwtAuthGuard } from '../src/shared/guards/jwt-auth.guard';
import { RateLimitService } from '../src/shared/services/rate-limit.service';
describe('push API contract', () => {
  let app: INestApplication;
  const identity = {
    type: 'access',
    studentId: 'student-jwt',
    deviceId: 'device-jwt',
    sessionId: 'session-jwt',
  };
  const service = {
    register: jest.fn().mockResolvedValue({
      id: 'endpoint-id',
      platform: 'ANDROID',
      permission: 'GRANTED',
    }),
    remove: jest.fn().mockResolvedValue({ count: 1 }),
    preferences: jest.fn(),
    updatePreferences: jest.fn(),
  };
  const dto = {
    transport: 'FCM',
    platform: 'ANDROID',
    fcmToken: 'secret-provider-token-'.repeat(4),
    firebaseProjectId: 'test',
    locale: 'fr',
    timezone: 'Europe/Berlin',
    appVersion: '1',
    permission: 'GRANTED',
    backgroundCapable: true,
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PushController],
      providers: [
        { provide: PushService, useValue: service },
        {
          provide: RateLimitService,
          useValue: { checkPushWriteLimit: jest.fn() },
        },
        {
          provide: FirebasePushService,
          useValue: {
            status: { enabled: false, configured: false, dryRun: true },
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: {
          switchToHttp: () => {
            getRequest: () => {
              headers: Record<string, string>;
              student?: unknown;
            };
          };
        }) => {
          const req = ctx.switchToHttp().getRequest();
          if (req.headers.authorization !== 'Bearer session-test')
            throw new UnauthorizedException();
          req.student = identity;
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });
  afterAll(async () => app?.close());
  it('requires authentication', async () => {
    await request(app.getHttpServer() as Server)
      .put('/api/me/push-endpoint')
      .send(dto)
      .expect(401);
  });
  it('rejects attempted ownership overrides before the service runs', async () => {
    await request(app.getHttpServer() as Server)
      .put('/api/me/push-endpoint')
      .set('Authorization', 'Bearer session-test')
      .send({ ...dto, studentId: 'other-account' })
      .expect(400);
  });
  it('uses JWT identity and never returns the provider address', async () => {
    const response = await request(app.getHttpServer() as Server)
      .put('/api/me/push-endpoint')
      .set('Authorization', 'Bearer session-test')
      .send(dto)
      .expect(200);
    expect(service.register).toHaveBeenLastCalledWith(
      identity,
      expect.objectContaining({ platform: 'ANDROID' }),
    );
    expect(JSON.stringify(response.body)).not.toContain(dto.fcmToken);
  });
  it('exports the endpoint body and readiness route in OpenAPI', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    expect(
      document.paths['/api/me/push-endpoint'].put?.requestBody,
    ).toBeDefined();
    expect(document.paths['/api/me/push-status'].get).toBeDefined();
    expect(document.components?.schemas?.RegisterPushDto).toBeDefined();
  });
});
