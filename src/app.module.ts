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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    GraphQLModule.forRoot<ApolloDriverConfig>({
<<<<<<< HEAD
      driver: ApolloDriver,
      csrfPrevention: false, // Mantener en false para compatibilidad con Apollo Sandbox y uploads
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      
      
      // ✅ CORRECCIÓN CLAVE: 
      // Eliminamos 'uploads: false' para permitir que el middleware de main.ts tome el control.
      // No ponemos 'uploads: true' porque esa es la configuración vieja de Apollo 2.
      
      playground: process.env.NODE_ENV !== 'production',
      introspection: process.env.NODE_ENV !== 'production',
      context: ({ req, res }: { req: any; res: any }) => ({ req, res }),

      formatError: (error) => {
        // Log detallado en consola para cazar cualquier error de multipart
        console.error('🚀 Vertex GraphQL Error:', error);
        return {
          message: error.message,
          code: error.extensions?.code,
          path: error.path,
        };
      },
    }),
=======
  driver: ApolloDriver,
  csrfPrevention: false, // Permite peticiones sin headers especiales
  autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
  sortSchema: true,
  playground: true,      // Forzamos visualización del playground en Render
  introspection: true,   // Forzamos lectura del esquema desde fuera
  context: ({ req, res }: { req: any; res: any }) => ({ req, res }),
  formatError: (error) => {
    // Esto te ayudará a debuguear errores en la consola de Render
    console.error('❌ GraphQL Error:', error);
    return {
      message: error.message,
      code: error.extensions?.code,
      path: error.path,
    };
  },
}),
>>>>>>> 6bf5987400caab120e289927937bb7636d667405

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
  }
}
