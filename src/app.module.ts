import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './shared/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { SpeakingModule } from './modules/speaking/speaking.module';
import { WritingModule } from './modules/writing/writing.module';
import { ListeningModule } from './modules/listening/listening.module';
import { ProgressModule } from './modules/progress/progress.module';
import { SeatErasureModule } from './modules/student-activity/seat-erasure.module';
import { SprachbausteineModule } from './modules/sprachbausteine/sprachbausteine.module';
import { LesenModule } from './modules/lesen/lesen.module';
import { ModelltestsModule } from './modules/modelltests/modelltests.module';
import { RateLimitModule } from './shared/rate-limit.module';
import { CentersModule } from './modules/centers/centers.module';
import { ExamsModule } from './modules/exams/exams.module';
import { MeModule } from './modules/me/me.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { LocationsModule } from './modules/locations/locations.module';
import { PlansModule } from './modules/plans/plans.module';
import { VitrineModule } from './modules/vitrine/vitrine.module';
import { PrepTipsModule } from './modules/prep-tips/prep-tips.module';
import { GrammarModule } from './modules/grammar/grammar.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      /**
       * `.env.test` first, then `.env`.
       *
       * `.env` holds production: running the app locally used to mean writing
       * to the live database, because it was the only file read. Anything
       * `.env.test` does not define — the Gemini key, the JWT secrets, the
       * port — still falls through to `.env`, so a developer keeps a working
       * app while their writes land on the disposable branch.
       *
       * Safe in production because `.env.test` is gitignored and therefore
       * cannot exist in the container: the list collapses to `.env` there,
       * and to the real environment variables that override both.
       */
      envFilePath: ['.env.test', '.env'],
    }),
    PrismaModule,
    RateLimitModule,
    AuthModule,
    CentersModule,
    ExamsModule,
    MeModule,
    NotificationsModule,
    SpeakingModule,
    WritingModule,
    ListeningModule,
    ProgressModule,
    SeatErasureModule,
    ModelltestsModule,
    SprachbausteineModule,
    LesenModule,
    LocationsModule,
    PlansModule,
    VitrineModule,
    PrepTipsModule,
    GrammarModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
