import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { AppModule } from './app.module';
import { SCANNER_QUEUE } from './modules/scanner/scanner.constants';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
    bodyParser: true,
  });

  // Raw body necessário para validar assinatura do webhook Clerk (Svix)
  app.use('/webhooks/clerk', (await import('express')).raw({ type: 'application/json' }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: true,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('MC Pulse API')
    .setDescription('Health check SaaS for Salesforce Marketing Cloud')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // BullBoard apenas em desenvolvimento — nunca exposto em prod
  if (process.env.NODE_ENV !== 'production') {
    const scannerQueue = app.get<Queue>(getQueueToken(SCANNER_QUEUE));
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');
    createBullBoard({
      queues: [new BullMQAdapter(scannerQueue)],
      serverAdapter,
    });
    app.use('/admin/queues', serverAdapter.getRouter());
  }

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  Logger.log(`MC Pulse API listening on :${port}`, 'Bootstrap');
}

void bootstrap();
