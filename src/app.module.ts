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
  autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
  sortSchema: true,
  playground: process.env.NODE_ENV !== 'production',
  introspection: process.env.NODE_ENV !== 'production',
  context: ({ req, res }) => ({ req, res }),
  
  // ✅ CONFIGURACIÓN MÍNIMA - SIN VALIDACIONES
  csrfPrevention: false,
  
  formatError: (error) => {
    console.error('GraphQL Error:', error);
    return {
      message: error.message,
      code: error.extensions?.code,
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

    // Solo dejamos los modelos que no tienen un módulo propio todavía
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Job.name, schema: JobSchema },
      { name: Notification.name, schema: NotificationSchema }  
    ]),

    JwtModule.register({
      secret: process.env.JWT_SECRET || 'vertex-secret-key-2024-super-secure',
      signOptions: {
        expiresIn: '60m',
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
    PaymentModule,
   
  ],

  providers: [
    AppResolver,
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
  }
}
