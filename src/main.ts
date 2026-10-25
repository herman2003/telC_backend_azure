import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import {
  APP_CREATE_OPTIONS,
  configureLifecycle,
  configureSecurity,
} from './bootstrap-config';

async function bootstrap() {
  // APP_CREATE_OPTIONS keeps each request's raw bytes, which payment webhook
  // signatures are computed over. See bootstrap-config.
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    APP_CREATE_OPTIONS,
  );
  // Trust proxy, helmet, the validation pipe, the auth filter and CORS. In
  // `bootstrap-config` so they can be tested without starting a server —
  // `void bootstrap()` below is why importing this file to check them cannot
  // work.
  configureSecurity(app);
  // Before listen: so a SIGTERM during/after boot still closes Prisma/Valkey.
  configureLifecycle(app);
  app.useStaticAssets(join(__dirname, '..', 'public'), { prefix: '/static' });
  // Local grammar illustrations (content/grammar-images). Off-instance by default:
  // URLs are only emitted when GRAMMAR_IMAGES_PUBLIC_BASE_URL is set.
  app.useStaticAssets(join(__dirname, '..', 'content', 'grammar-images'), {
    prefix: '/static/grammar-images',
  });

  // No Swagger UI. Serving interactive docs publicly mapped the whole API.
  // HTTP checks live in bruno/; @Api* decorators may remain for OpenAPI
  // metadata in tests without mounting a docs page.

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');

  // Which database this process is actually talking to, host only — never the
  // credentials. `.env` is production and `.env.test` is a disposable branch,
  // and the difference between them is invisible until something has already
  // been written. One line at boot makes it impossible to be unsure.
  Logger.log(`Listening on ${port}, database ${databaseHost()}`, 'Bootstrap');
}

function databaseHost(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return 'none configured';
  try {
    return new URL(url).host;
  } catch {
    // A malformed URL is the database layer's problem to report, not this
    // line's; saying so beats crashing the boot log.
    return 'unreadable';
  }
}
void bootstrap();
