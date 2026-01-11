import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import * as express from 'express';
import { json } from 'express';

async function bootstrap() {
  const logger = new Logger('VertexBootstrap');
  const app = await NestFactory.create(AppModule);

  // ✅ CORS ÚNICO Y CORRECTO
  app.enableCors({
    origin: [
      'http://localhost:4200', // desarrollo
      'https://vertexservicespro.netlify.app', // producción
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'apollo-require-preflight'],
    exposedHeaders: ['Content-Type'],
    maxAge: 3600,
  });

  // Aumentar payload
  app.use(express.json({ limit: '200mb' }));
  app.use(express.urlencoded({ limit: '200mb', extended: true }));

  // Raw body para Stripe webhooks
  app.use('/webhooks/stripe', json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf.toString();
    }
  }));

  // JSON parser para el resto
  app.use(json());

  const port = process.env.PORT || 4001;
  await app.listen(port);
  logger.log(`🚀 Vertex Enterprise Server ready at http://localhost:${port}/graphql`);
}

bootstrap();
