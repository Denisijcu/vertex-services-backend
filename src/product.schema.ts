import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ObjectType, Field, ID, Float } from '@nestjs/graphql';

@ObjectType() // Esto le dice a GraphQL que esta clase es un "Tipo" de salida
@Schema()
export class Product extends Document {
  @Field(() => ID) // GraphQL necesita saber que el ID es un tipo especial
  id: string;

  @Field() // Campo visible en GraphQL
  @Prop({ required: true })
  name: string;

  @Field(() => Float) // Especificamos que el precio es un número decimal
  @Prop({ required: true })
  price: number;
}

export const ProductSchema = SchemaFactory.createForClass(Product);