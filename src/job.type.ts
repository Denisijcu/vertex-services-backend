import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class JobType {
  @Field(() => ID)
  _id: string;

  @Field()
  title: string;

  @Field()
  description: string;

  @Field()
  status: string;

  @Field()
  price: number;
}
