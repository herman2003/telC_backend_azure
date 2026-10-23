import { Module } from '@nestjs/common';
import { LesenController } from './lesen.controller';
import { LesenService } from './lesen.service';
import { PrismaModule } from '../../shared/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionAccessModule } from '../../shared/subscription-access.module';
import { GenericExamContentService } from '../../shared/services/generic-exam-content.service';

@Module({
  imports: [PrismaModule, AuthModule, SubscriptionAccessModule],
  controllers: [LesenController],
  providers: [LesenService, GenericExamContentService],
  exports: [LesenService],
})
export class LesenModule {}
