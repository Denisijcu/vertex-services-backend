import { Module, forwardRef } from '@nestjs/common'; // Agregamos forwardRef por seguridad
import { MongooseModule } from '@nestjs/mongoose';
import { UserService } from './auth/user.service';
import { User, UserSchema } from './user.schema';
import { AuthModule } from './auth/auth.module'; 

@Module({
  imports: [
    AuthModule, 
    UserModule, 
    ChatModule,
    MongooseModule.forFeature([
      { name: Job.name, schema: JobSchema },
      { name: Notification.name, schema: NotificationSchema },
    ]),
  ],
  providers: [
    JobResolver, 
    JobService,
    NotificationService,
  ],
  exports: [
    JobService, 
    NotificationService, 
    MongooseModule // Vital para que AppResolver vea los modelos
  ], 
})
export class JobModule {} // 👈 ASEGÚRATE DE QUE TENGA EL 'export'
