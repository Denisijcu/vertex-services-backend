import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JobResolver } from './job.resolver';
import { JobService } from './auth/job.service';
import { Job, JobSchema } from './job.schema';
import { Notification, NotificationSchema } from './notification.schema';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user.module';
import { NotificationService } from './auth/notification.service'; // 👈 Asegúrate de importar el SERVICIO aquí
import { ChatModule } from './chat.module'

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
    NotificationService, // 👈 REGÍSTRALO AQUÍ como proveedor
  ],
  exports: [JobService, NotificationService], // Expórtalo por si lo usas en otro lado
})
export class JobModule {}