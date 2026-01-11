import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AIBotResolver } from './ai-bot.resolver';
import { AIBotService } from './auth/ai-bot.service';
import { User, UserSchema } from './user.schema';
import { Job, JobSchema } from './job.schema';
import { SettingsResolver } from './settings.resolver';

import { JobModule } from './job.module';
import { PaymentModule } from './payment/payment.module';
import { UserModule } from './user.module';

// 1. IMPORTA EL SCHEMA DE SETTINGS
import { Settings, SettingsSchema } from './settings.schema'; 
// Importa los servicios que acabas de agregar al constructor
import { UserService } from './auth/user.service';           // ajusta la ruta real
import { CategoryService } from './category.service';
import { Category, CategorySchema } from './category.schema';

import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    JobModule,      // 👈 Aquí vive el JobService
    PaymentModule,  // 👈 Aquí vive el PaymentService
    UserModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Job.name, schema: JobSchema },
      // ✅ PASO CLAVE: Registra el Settings aquí para que el Resolver pueda usarlo
      { name: Settings.name, schema: SettingsSchema } ,
      { name: Category.name, schema: CategorySchema },
    ]),
    AuthModule, // 👈 Para que el AIBotService pueda usar UserService
  ],
  providers: [AIBotResolver, AIBotService, SettingsResolver, CategoryService, UserService],
  exports: [AIBotService]
})
export class AIBotModule {}