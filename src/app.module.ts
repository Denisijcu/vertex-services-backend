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
import { JobModule } from './job.module';
import { PulseModule } from './pulse/pulse.module';
import { UserModule } from './user.module';
import { ChatModule } from './chat.module';
import { PaymentModule } from './payment/payment.module';

// Schemas y Resolvers globales
import { AdminResolver } from './admin.resolver';
import { AdminService } from './admin.service';
import { AppResolver } from './app.resolver';
import { UserResolver } from './user.resolver';
import { CategoryResolver } from './category.resolver';
import { CategoryService } from './category.service';
import { NotificationService } from './auth/notification.service';
import { Notification, NotificationSchema } from './notification.schema';
import { UserService } from './auth/user.service';
import { User, UserSchema } from './user.schema';
import { Category, CategorySchema } from './category.schema';
import { Job, JobSchema } from './job.schema';

import { CloudinaryModule } from './cloudinary/cloudinary.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      csrfPrevention: false,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      playground: process.env.NODE_ENV !== 'production',
      introspection: process.env.NODE_ENV !== 'production',
      
      // 🔥 CORRECCIÓN CLAVE: Context mejorado
      context: ({ req, res }: { req: any; res: any }) => {
        console.log('🎯 GraphQL Context creado');
        console.log('🔑 Authorization Header:', req?.headers?.authorization ? '✅ Presente' : '❌ Ausente');
        console.log('🍪 Cookie token:', req?.cookies?.token ? '✅ Presente' : '❌ Ausente');
        
        return { req, res };
      },

      formatError: (error) => {
        console.error('🚀 Vertex GraphQL Error:', {
          message: error.message,
          code: error.extensions?.code,
          path: error.path,
          originalError: error.extensions?.originalError,
        });
        return {
          message: error.message,
          code: error.extensions?.code,
          path: error.path,
        };
      },
    }),

    MongooseModule.forRoot(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/vertex-coders-db',
      {
        autoIndex: true,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      }
    ),

    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Job.name, schema: JobSchema },
      { name: Notification.name, schema: NotificationSchema }
    ]),

    JwtModule.register({
      secret: process.env.JWT_SECRET || 'vertex-secret-key-2024-super-secure',
      signOptions: {
        expiresIn: '60m', // 👈 Considera aumentar a '7d' para desarrollo
        issuer: 'vertex-amazon-api',
      },
      global: true,
    }),

    AuthModule,
    AIBotModule,
    JobModule,
    UserModule,
    ChatModule,
    PulseModule,
     CloudinaryModule,
    PaymentModule,
  ],

  providers: [
    AppResolver,
    AdminService,
    AdminResolver,
    UserService,
    CategoryResolver,
    CategoryService,
    UserResolver,
    NotificationService,
  ],
})
export class AppModule {
  constructor() {
    console.log('🚀 Vertex Enterprise Server initialized');
    console.log('🔐 JWT Secret configured:', process.env.JWT_SECRET ? '✅' : '❌ USING DEFAULT');
    console.log('🗄️ MongoDB URI:', process.env.MONGODB_URI ? '✅ Configured' : '❌ Using localhost');
  }
}