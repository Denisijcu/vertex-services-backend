import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import * as express from 'express';
import { json } from 'express';

async function bootstrap() {
  const logger = new Logger('VertexBootstrap');
  const app = await NestFactory.create(AppModule);

  // 1. Aumentar el límite de carga
  app.use(express.json({ limit: '200mb' }));
  app.use(express.urlencoded({ limit: '200mb', extended: true }));

  // 2. CORS CON HEADERS APOLLO
 
  app.enableCors({
  origin: ['https://tu-app-angular.netlify.app', 'http://localhost:4200'],
  credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'apollo-require-preflight', 'x-apollo-operation-name']
});
  // Raw body para webhooks de Stripe
  app.use('/webhooks/stripe', json({
<<<<<<< HEAD
    verify: (req: any, _res: any, buf: Buffer) => {
      req.rawBody = buf.toString();
      
=======
    verify: (req: any, res, buf) => {
      req.rawBody = buf.toString();
>>>>>>> b5ca08a6a880c0645246c9c0422827494c72e452
    }
  }));

  // JSON body parser para el resto
  app.use(json());

  const port = 4001;
  await app.listen(port);

  logger.log(`🚀 Vertex Enterprise Server ready at http://localhost:${port}/graphql`);
}
<<<<<<< HEAD
bootstrap();
=======
bootstrap();
>>>>>>> b5ca08a6a880c0645246c9c0422827494c72e452
