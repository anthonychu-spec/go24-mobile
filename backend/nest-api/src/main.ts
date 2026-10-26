import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  // Native apps don't send Origin, so they need no CORS. Only browser clients listed
  // in CORS_ORIGINS (comma-separated, e.g. the Expo web dev server) are allowed.
  const corsOrigins = (process.env.CORS_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const isProd = process.env.NODE_ENV === 'production';

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: corsOrigins.length ? { origin: corsOrigins } : false,
    snapshot: true, // for Devtools module graph
  });

  // Behind Caddy: take the client IP from X-Forwarded-For (one hop) so per-IP rate limits work
  app.set('trust proxy', 1);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('v1');

  // Swagger / OpenAPI — visual API explorer at /api-docs (not served in production;
  // Caddy also blocks /api-docs and /v1/metrics from outside)
  if (!isProd) setupSwagger(app);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 GO24 API:        http://localhost:${port}/v1`);
  if (!isProd) {
    console.log(`📖 Swagger UI:      http://localhost:${port}/api-docs`);
    console.log(`🧭 Devtools graph:  https://devtools.nestjs.com (pair with PORT 8000)`);
  }
}

function setupSwagger(app: NestExpressApplication) {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('GO24 Mobile API')
    .setDescription('Backend API for GO24 Member + Trainer apps')
    .setVersion('0.1')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', name: 'Authorization', in: 'header' },
      'jwt',
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}
void bootstrap();
