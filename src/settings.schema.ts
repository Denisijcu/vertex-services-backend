import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
@Schema({ timestamps: true })
export class Settings extends Document {
  @Field()
  @Prop({ required: true, default: 'LOCAL' }) // 'LOCAL', 'OPENAI', 'GEMINI'
  aiProvider: string;

  @Field({ nullable: true })
  @Prop()
  apiKey: string;

  @Field()
  @Prop({ default: 'http://localhost:1234/v1' })
  baseUrl: string;

  @Field()
  @Prop({ default: 'qwen-model' })
  modelName: string;
}

export const SettingsSchema = SchemaFactory.createForClass(Settings);