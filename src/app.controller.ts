import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './shared/services/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * Readiness for DigitalOcean / Docker / uptime monitors.
   * Process up is not enough — Neon must answer too.
   */
  @Get('health')
  async health(): Promise<{ ok: true }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true };
    } catch {
      throw new ServiceUnavailableException({
        ok: false,
        reason: 'DATABASE_UNAVAILABLE',
      });
    }
  }
}
