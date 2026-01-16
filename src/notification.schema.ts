import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export type NotificationDocument = Notification & Document;

@ObjectType()
@Schema({ timestamps: true })
export class Notification {
  @Field(() => ID)
  _id: Types.ObjectId;

  @Field(() => ID)
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  recipientId: Types.ObjectId;

  @Field()
  @Prop({ required: true })
  message: string;

  @Field()
  @Prop({ default: false })
  isRead: boolean;

  @Field(() => ID, { nullable: true })
  @Prop({ type: Types.ObjectId, ref: 'Job' })
  jobId?: Types.ObjectId;

  @Field({ nullable: true })
  @Prop()
  type?: string;

  // 🆕 NUEVO CAMPO PARA ALERTAS DEL SISTEMA
  @Field({ nullable: true })
  @Prop()
  severity?: string; // 'INFO', 'WARNING', 'ERROR', 'SUCCESS'

  @Field(() => Date, { nullable: true })
  createdAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Índices para mejor performance
NotificationSchema.index({ recipientId: 1, isRead: 1 });
NotificationSchema.index({ createdAt: -1 });
NotificationSchema.index({ type: 1 });
