// backend/src/pulse/pulse.schema.ts
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@ObjectType()
@Schema()
export class Comment {
  @Field({ nullable: true }) 
  @Prop() 
  authorId: string;

  @Field({ nullable: true }) 
  @Prop() 
  authorName: string;

  @Field({ nullable: true }) 
  @Prop() 
  avatar?: string;

  @Field({ nullable: true }) 
  @Prop() 
  content: string;

  @Field({ nullable: true }) 
  @Prop({ default: Date.now }) 
  createdAt: Date;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);

@ObjectType()
@Schema({ timestamps: true })
export class PulsePost extends Document {
  @Field(() => ID, { name: 'pulseId' })
  get pulseId(): string {
    return this._id?.toString() || '';
  }

  @Field()
  @Prop({ required: true, index: true })
  authorId: string;

  @Field({ nullable: true }) 
  @Prop()
  authorName: string;

  @Field({ nullable: true }) 
  @Prop()
  avatar: string;

  @Field()
  @Prop({ required: true })
  content: string;

  @Field({ nullable: true })
  @Prop()
  imageUrl?: string;

  @Field(() => [String])
  @Prop({ type: [String], default: [] })
  likes: string[];

  @Field(() => [Comment])
  @Prop({ type: [CommentSchema], default: [] })
  comments: Comment[];

  @Field({ nullable: true })
  @Prop({ default: 'GENERAL', index: true })
  category?: string;

  @Field({ nullable: true }) 
  @Prop() 
  mediaUrl: string;

  @Field({ nullable: true }) 
  @Prop() 
  mediaType: string;

  // 🔧 NUEVO: Campo de views
  @Field({ nullable: true })
  @Prop({ default: 0 })
  views: number;

  @Field()
  @Prop({ index: -1 })
  createdAt: Date;
}

export const PulsePostSchema = SchemaFactory.createForClass(PulsePost);

PulsePostSchema.index({ category: 1, createdAt: -1 });
PulsePostSchema.index({ authorId: 1, createdAt: -1 });