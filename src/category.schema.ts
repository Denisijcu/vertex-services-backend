import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
@Schema({ timestamps: true })
export class Category {
  // ✅ Cambiamos el tipo a any o simplemente lo omitimos de la clase 
  // para que Mongoose lo inyecte sin conflictos.
  @Field(() => ID)
  _id: Types.ObjectId;

  @Field()
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  @Field()
  @Prop({ required: true, unique: true, trim: true })
  slug: string;

  @Field({ nullable: true })
  @Prop()
  description: string;

  @Field()
  @Prop({ required: true })
  icon: string;

  @Field()
  @Prop({ default: '#8B5CF6' })
  color: string;

  @Field(() => [String])
  @Prop({ type: [String], default: [] })
  skills: string[];

  @Field(() => [String])
  @Prop({ type: [String], default: [] })
  keywords: string[];

  @Field()
  @Prop({ default: true })
  isActive: boolean;

  @Field()
  @Prop({ default: 0 })
  providersCount: number;

  @Field()
  @Prop({ default: 0 })
  jobsCount: number;

  @Field(() => ID, { nullable: true })
  @Prop({ type: Types.ObjectId, ref: 'Category' })
  parentCategory?: Types.ObjectId;

  @Field()
  @Prop({ default: 0 })
  order: number;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

// ✅ Esta es la línea clave: define el tipo Document correctamente
export type CategoryDocument = Category & Document;
export const CategorySchema = SchemaFactory.createForClass(Category);

// Índices para búsqueda optimizada
CategorySchema.index({ name: 'text', keywords: 'text' });
CategorySchema.index({ slug: 1 });
CategorySchema.index({ isActive: 1, order: 1 });