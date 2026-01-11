import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// 1. ESQUEMA DE COMENTARIOS (Sub-documento)
@ObjectType()
@Schema()
export class Comment {
  @Field({ nullable: true }) @Prop() authorId: string;
  @Field({ nullable: true }) @Prop() authorName: string;
  @Field({ nullable: true }) @Prop() avatar?: string;
  @Field({ nullable: true }) @Prop() content: string;
  @Field({ nullable: true }) @Prop({ default: Date.now }) createdAt: Date;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);

// 2. ESQUEMA DE POST PRINCIPAL
@ObjectType()
@Schema({ timestamps: true })
export class PulsePost extends Document {
  @Field(() => ID, { name: 'pulseId' })
  id: string; // Mapeo del ID de Mongoose para el frontend

  @Field()
  @Prop({ required: true })
  authorId: string;

  @Field({ nullable: true }) @Prop()
  authorName: string;

  @Field({ nullable: true }) @Prop()
  avatar: string;

  @Field()
  @Prop({ required: true })
  content: string;

  @Field({ nullable: true })
  @Prop()
  imageUrl?: string;

  @Field(() => [String])
  @Prop({ type: [String], default: [] }) // 🛡️ Garantiza que siempre sea un array
  likes: string[];

  @Field(() => [Comment])
  @Prop({ type: [CommentSchema], default: [] }) // 🛡️ La clave de la interacción social
  comments: Comment[];

  @Field({ nullable: true })
  @Prop({ default: 'GENERAL' })
  category?: string;

  @Field({ nullable: true }) @Prop() 
  mediaUrl: string;

  @Field({ nullable: true }) @Prop() 
  mediaType: string;

  @Field()
  createdAt: Date;
}

export const PulsePostSchema = SchemaFactory.createForClass(PulsePost);