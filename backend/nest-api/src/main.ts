import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: true,
    snapshot: true, // for Devtools module graph
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('v1');

  // Swagger / OpenAPI — visual API explorer at /api-docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('GO24 Mobile API')
    .setDescription('Backend API for GO24 Member + Trainer apps')
    .setVersion('0.1')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', name: 'Authorization', in: 'header' },
      'jwt',
    )
    .addServer('/v1')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 GO24 API:        http://localhost:${port}/v1`);
  console.log(`📖 Swagger UI:      http://localhost:${port}/api-docs`);
  console.log(`🧭 Devtools graph:  https://devtools.nestjs.com (pair with PORT 8000)`);
}
void bootstrap();
