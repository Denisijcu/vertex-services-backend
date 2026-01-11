import { ObjectType, Field, Float } from '@nestjs/graphql';

@ObjectType()
export class ServiceOfferedType {
  @Field({ nullable: true }) // 👈 Agregado nullable
  category: string;
  
  @Field() 
  title: string;
  
  @Field({ nullable: true }) // 👈 Agregado nullable
  description: string;
  
  @Field(() => Float) 
  pricePerHour: number;
  
  @Field({ defaultValue: true }) // 👈 Agregado default
  isActive: boolean;
}