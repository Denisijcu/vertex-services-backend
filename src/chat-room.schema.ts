import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ObjectType, Field, ID } from '@nestjs/graphql';

@Schema({ _id: false })
@ObjectType()
export class Participant {
  @Field(() => ID)
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  _id: Types.ObjectId;

  @Field()
  @Prop({ required: true })
  name: string;

  @Field({ nullable: true })
  @Prop()
  avatar?: string;

  @Field()
  @Prop({ required: true, enum: ['client', 'provider'] })
  role: string;

  @Field()
  @Prop({ default: 0 })
  unreadCount: number;
}


@ObjectType()
class LastMessageInfo {
  @Field()
  content: string;

  @Field()
  senderName: string;

  @Field()
  createdAt: Date;

  @Field()
  isRead: boolean;
}

@ObjectType()
@Schema({ timestamps: true })
export class ChatRoom {
  @Field(() => ID)
  _id: Types.ObjectId;

  @Field(() => ID)
  @Prop({ type: Types.ObjectId, ref: 'Job', required: true, unique: true })
  jobId: Types.ObjectId;

  @Field()
  @Prop({ required: true })
  jobTitle: string;

  @Field(() => [Participant])
  @Prop({ type: Array, required: true })
  participants: Participant[];

  @Field(() => LastMessageInfo, { nullable: true })
  @Prop({ type: Object })
  lastMessage?: LastMessageInfo;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

export type ChatRoomDocument = ChatRoom & Document;
export const ChatRoomSchema = SchemaFactory.createForClass(ChatRoom);

// Índice para búsquedas rápidas
ChatRoomSchema.index({ 'participants._id': 1 });