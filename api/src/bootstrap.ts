import { type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { AppModule, type AppDeps } from './app.module';
import { PinoNestLogger } from './logging/logger';

export async function createApp(deps: AppDeps): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule.forRoot(deps), { logger: new PinoNestLogger() });
  app.useWebSocketAdapter(new WsAdapter(app));
  app.enableShutdownHooks();
  // Admin web is served from swasthyaiq.cognihealth.in; the Android app does not need CORS.
  app.enableCors({
    origin: [
      /^https:\/\/swasthyaiq\.cognihealth\.in$/,
      /^https:\/\/dev\.swasthyaiq\.cognihealth\.in$/,
      /^http:\/\/localhost:\d+$/,
    ],
  });
  return app;
}

export function buildOpenApi(app: INestApplication, version: string): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('SwasthyaIQ API (Arihant prototype)')
    .setDescription('Synthetic data only. Prototype — not for clinical use.')
    .setVersion(version)
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, config);
}
