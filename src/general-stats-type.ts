import { ObjectType, Field, Int, Float } from '@nestjs/graphql';

@ObjectType()
export class GeneralStatsType {
  @Field(() => Int)
  totalUsers: number;

  @Field(() => Int)
  totalProviders: number;

  @Field(() => Int)
  totalClients: number;

  @Field(() => Int)
  activeUsers: number;

  @Field(() => Float)
  totalEarnings: number;
}