import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { EmailService } from '../auth/email.service';
import { validateDemoSlot } from './demo-slot';
import type { DemoRequestDto } from './dto/demo-request.dto';

@Injectable()
export class VitrineDemoService {
  private readonly logger = new Logger(VitrineDemoService.name);

  constructor(private readonly email: EmailService) {}

  async requestDemo(dto: DemoRequestDto): Promise<{ ok: true }> {
    const slot = validateDemoSlot(dto.slotStart);
    if (!slot.ok) {
      throw new BadRequestException(slot.reason);
    }

    const payload = {
      fullName: dto.fullName.trim(),
      email: dto.email.trim().toLowerCase(),
      whatsapp: dto.whatsapp.trim(),
      centerName: dto.centerName.trim(),
      studentBand: dto.studentBand.trim(),
      message: dto.message?.trim() || undefined,
      locale: dto.locale ?? 'de',
      slotLabel: slot.berlinLabel,
      slotStart: new Date(dto.slotStart),
    };

    try {
      await this.email.sendDemoConfirmationToClient(payload);
    } catch (error) {
      this.logger.error(
        `Demo confirmation to ${payload.email} failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new BadGatewayException('EMAIL_DELIVERY_FAILED');
    }

    try {
      await this.email.sendDemoRequestToTeam(payload);
    } catch (error) {
      // Client already has their confirmation — team alert is best-effort.
      this.logger.warn(
        `Demo team alert failed for ${payload.email}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return { ok: true };
  }
}
