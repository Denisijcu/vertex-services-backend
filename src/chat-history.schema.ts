// ==========================================
// 1. CHAT HISTORY SCHEMA (backend/src/chat-history.schema.ts)
// ==========================================
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
@Schema({ timestamps: true })
export class ChatHistory {
  @Field(() => ID)
  _id: Types.ObjectId;

  @Field(() => ID)
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Field()
  @Prop({ required: true })
  message: string;

  @Field()
  @Prop({ required: true })
  response: string;

  @Field()
  @Prop({ required: true, enum: ['user', 'bot'] })
  role: string;

  @Field({ nullable: true })
  @Prop()
  functionCalled?: string;

  @Field({ nullable: true })
  @Prop({ type: Object })
  functionResult?: any;

  @Field()
  @Prop({ default: Date.now })
  timestamp: Date;

  @Field()
  @Prop({ default: 'lmstudio' })
  provider: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

export type ChatHistoryDocument = ChatHistory & Document;
export const ChatHistorySchema = SchemaFactory.createForClass(ChatHistory);
