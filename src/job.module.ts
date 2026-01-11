import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JobResolver } from './job.resolver';
import { JobService } from './auth/job.service';
import { Job, JobSchema } from './job.schema';
import { Notification, NotificationSchema } from './notification.schema';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user.module';
import { NotificationService } from './auth/notification.service';
import { ChatModule } from './chat.module';

@Module({
  imports: [
    AuthModule, 
    UserModule, 
    ChatModule,
    // Definimos los modelos para que este módulo los use
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
    MongooseModule // <--- Esto permite que el AppResolver vea el JobModel
  ], 
})
export class JobModule {}
