import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType('ChatFileMetadata') // 👈 AGREGADO: nombre único para GraphQL
class FileMetadata {
  @Field({ nullable: true })
  originalName?: string;

  @Field({ nullable: true })
  mimeType?: string;

  @Field({ nullable: true })
  size?: number;

  @Field({ nullable: true })
  duration?: number; // Para audio/video en segundos

  @Field({ nullable: true })
  thumbnail?: string; // URL del thumbnail para videos
}

@ObjectType('ChatMessage') // 👈 YA ESTABA
@Schema({ timestamps: true })
export class Message {
  @Field(() => ID)
  _id: Types.ObjectId;

  @Field(() => ID)
  @Prop({ type: Types.ObjectId, ref: 'Job', required: true, index: true })
  jobId: Types.ObjectId;

  @Field(() => ID)
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Field()
  @Prop({ required: true })
  senderName: string;

  @Field({ nullable: true })
  @Prop()
  senderAvatar?: string;

  @Field()
  @Prop({ required: true, maxlength: 5000 })
  content: string;

  @Field()
  @Prop({ default: 'text', enum: ['text', 'image', 'video', 'audio', 'file'] })
  type: string;

  @Field({ nullable: true })
  @Prop()
  fileUrl?: string;

  @Field(() => FileMetadata, { nullable: true })
  @Prop({ type: Object })
  fileMetadata?: FileMetadata;

  @Field()
  @Prop({ default: false })
  isRead: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

export type MessageDocument = Message & Document;
export const MessageSchema = SchemaFactory.createForClass(Message);

MessageSchema.index({ jobId: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1 });