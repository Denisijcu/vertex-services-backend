import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import * as express from 'express'; // 👈 Asegúrate de importar express
import { json } from 'express';

async function bootstrap() {
  const logger = new Logger('VertexBootstrap');
  const app = await NestFactory.create(AppModule);

  // 1. Aumentar el límite de carga (Payload)
  // Esto permite que el servidor acepte los strings largos de tus fotos/videos
  app.use(express.json({ limit: '200mb' }));
  app.use(express.urlencoded({ limit: '200mb', extended: true }));
  // 2. Tu CORS se queda igual (está perfecto)
  app.enableCors({
    origin: 'http://localhost:4200',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  });


  // 🔥 IMPORTANTE: Raw body para webhooks de Stripe
  app.use('/webhooks/stripe', json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf.toString();
    }
  }));

  // JSON body parser para el resto
  app.use(json());


  const port = 4001;
  await app.listen(port);

  logger.log(`🚀 Vertex Enterprise Server ready at http://localhost:${port}/graphql`);
}
bootstrap();