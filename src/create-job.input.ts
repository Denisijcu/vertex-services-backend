import { InputType, Field, ID, Float } from '@nestjs/graphql';

@InputType('CreateJobInputData') // 👈 Solo añade este texto aquí adentro
export class CreateJobInput {
  @Field()
  title: string;

  @Field()
  description: string;

  @Field(() => Float)
  price: number;

  @Field()
  location: string;

  @Field()
  category: string; 

  @Field(() => ID)
  providerId: string;
}