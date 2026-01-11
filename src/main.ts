import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
<<<<<<< HEAD
import { Logger } from '@nestjs/common';
import * as express from 'express';
import { json } from 'express';
=======
import { Logger, ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
>>>>>>> 9206256161f977d2177b8629c5d075496b92d738

async function bootstrap() {
  const logger = new Logger('VertexBootstrap');
  const app = await NestFactory.create(AppModule);

<<<<<<< HEAD
  // 1. Aumentar el límite de carga
  app.use(express.json({ limit: '200mb' }));
  app.use(express.urlencoded({ limit: '200mb', extended: true }));

  // 2. CORS CON HEADERS APOLLO
  app.enableCors({
    origin: 'http://localhost:4200',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'apollo-require-preflight', 'x-apollo-operation-name']
  });

  // Raw body para webhooks de Stripe
=======
  // 1. Raw body para Stripe (DEBE IR ANTES de los parsers globales)
>>>>>>> 9206256161f977d2177b8629c5d075496b92d738
  app.use('/webhooks/stripe', json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    }
  }));

  // 2. Parsers Globales (Solo una vez)
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));

<<<<<<< HEAD
  const port = 4001;
=======
  // 3. CORS
  app.enableCors({
    origin: [
      'http://localhost:4200',
      'https://vertexservicespro.netlify.app',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'apollo-require-preflight'],
  });

  // 4. Pipes de validación (Ayuda a que los errores sean objetos reales)
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  const port = process.env.PORT || 10000; // Render usa 10000 por defecto
>>>>>>> 9206256161f977d2177b8629c5d075496b92d738
  await app.listen(port);
  logger.log(`🚀 Vertex Enterprise Server ready at port: ${port}`);
}

bootstrap();
