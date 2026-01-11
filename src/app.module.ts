import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { join } from 'path';

// Módulos
import { AuthModule } from './auth/auth.module';
import { AIBotModule } from './ai-bot.module';
import { JobModule } from './job.module'; // 👈 IMPORTAMOS EL NUEVO MÓDULO
import { PulseModule } from './pulse/pulse.module';

// Schemas y Resolvers globales
import { AdminResolver } from './admin.resolver';
import { AppResolver } from './app.resolver';
import { UserResolver } from './user.resolver';
import { CategoryResolver } from './category.resolver';
import { CategoryService } from './category.service';
import { NotificationService } from './auth/notification.service';
import { Notification, NotificationSchema } from './notification.schema';
import { UserService } from './auth/user.service';
import { User, UserSchema } from './user.schema';
import { Category, CategorySchema } from './category.schema';
import { Job, JobSchema } from './job.schema'
import { UserModule } from './user.module';
import { ChatModule } from './chat.module';
import { PaymentModule } from './payment/payment.module';


// ✅ AGREGAR ESTO
const isProduction = process.env.NODE_ENV === 'production';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      // Cambia esto para que no use rutas absolutas que fallen en Render
      autoSchemaFile: true, 
      sortSchema: true,
      playground: true, // Déjalo en true un momento para probar
      introspection: true,
      context: ({ req, res }) => ({ req, res }),
      formatError: (error) => {
        // Log simplificado para no chocar con instanceof
        console.error('❌ GraphQL Error:', error.message);
        return error;
      },
    }),

    MongooseModule.forRoot(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/vertex-coders-db',
    ),

    // ⚠️ QUITA EL MongooseModule.forFeature DE AQUÍ
    // Debe estar dentro de UserModule, JobModule, etc.

    JwtModule.register({
      secret: process.env.JWT_SECRET || 'vertex-secret-key-2024-super-secure',
      signOptions: { expiresIn: '60m' },
      global: true,
    }),

    // Solo los módulos, ellos se encargan de sus servicios
    AuthModule,
    AIBotModule,
    JobModule,
    UserModule,
    ChatModule,
    PulseModule,
    PaymentModule,
  ],
  providers: [
    AppResolver,
    AdminResolver,
    // ⚠️ QUITA UserService, CategoryService, etc. DE AQUÍ
    // Si necesitas CategoryResolver, asegúrate de que CategoryModule lo exporte
  ],
})
export class AppModule {
  constructor() {
    console.log('🚀 Vertex Enterprise Server initialized');
  }
}
