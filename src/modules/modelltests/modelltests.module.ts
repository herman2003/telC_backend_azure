import { Module } from '@nestjs/common';
import { ModelltestsController } from './modelltests.controller';
import { ModelltestOfTheWeekController } from './modelltest-of-the-week.controller';
import { ModelltestsService } from './modelltests.service';
import { PrismaModule } from '../../shared/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionAccessModule } from '../../shared/subscription-access.module';
import { WritingModule } from '../writing/writing.module';
import { SpeakingModule } from '../speaking/speaking.module';
import { ListeningModule } from '../listening/listening.module';
import { LesenService } from '../lesen/lesen.service';
import { SprachbausteineService } from '../sprachbausteine/sprachbausteine.service';
import { GenericExamContentService } from '../../shared/services/generic-exam-content.service';

@Module({
  // Writing / Speaking / Listening power of-the-week content the same way
  // CentersModule builds manager preview — skill services, not a second pipeline.
  imports: [
    PrismaModule,
    AuthModule,
    SubscriptionAccessModule,
    WritingModule,
    SpeakingModule,
    ListeningModule,
  ],
  controllers: [ModelltestOfTheWeekController, ModelltestsController],
  providers: [
    ModelltestsService,
    LesenService,
    SprachbausteineService,
    GenericExamContentService,
  ],
})
export class ModelltestsModule {}
