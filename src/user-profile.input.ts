
import { InputType, Field, Float, ID } from '@nestjs/graphql';

@InputType()
class ServiceOfferInput {
  @Field(() => ID)
  categoryId: string;

  @Field()
  title: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Float)
  pricePerHour: number;
}

@InputType()
export class UpdateProfessionalProfileInput {
  @Field({ nullable: true })  // 👈 Agrega este campo
  name?: string;

  @Field({ nullable: true }) 
  avatar?: string;

  @Field({ nullable: true })
  bio?: string;

  @Field({ nullable: true })
  location?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field(() => [ServiceOfferInput], { nullable: 'items' })
  services?: ServiceOfferInput[];

  @Field(() => [String], { nullable: 'itemsAndList' }) 
  gallery?: string[];
}