import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatService } from './chat.service';
import { ChatResolver } from './chat.resolver';
import { ChatGateway } from './chat.gateway';
import { Message, MessageSchema } from './message.schema';
import { ChatRoom, ChatRoomSchema } from './chat-room.schema';
import { Job, JobSchema } from './job.schema';
import { User, UserSchema } from './user.schema';
import { UploadService } from './upload.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: ChatRoom.name, schema: ChatRoomSchema },
      { name: Job.name, schema: JobSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [ChatService, ChatResolver, ChatGateway,UploadService],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}