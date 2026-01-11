import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const logger = new Logger('VertexBootstrap');
  const app = await NestFactory.create(AppModule);

  // 1. Raw body para Stripe (DEBE IR ANTES de los parsers globales)
  app.use('/webhooks/stripe', json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    }
  }));

  // 2. Parsers Globales (Solo una vez)
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));

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
  await app.listen(port);
  logger.log(`🚀 Vertex Enterprise Server ready at port: ${port}`);
}

bootstrap();
