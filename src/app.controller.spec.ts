import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './shared/services/prisma.service';

describe('AppController', () => {
  let appController: AppController;
  const prisma = {
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('returns { ok: true } when the database answers', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      await expect(appController.health()).resolves.toEqual({ ok: true });
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('throws 503 when the database is unreachable', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

      await expect(appController.health()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });
});
