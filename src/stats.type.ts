import { ObjectType, Field, Float } from '@nestjs/graphql';

@ObjectType()
export class StatsType {
  @Field(() => Float, { defaultValue: 0 })
  jobsCompleted: number;

  @Field(() => Float, { defaultValue: 0 })
  jobsReceived: number;

  @Field(() => Float, { defaultValue: 0 })
  totalEarned: number;

  @Field(() => Float, { defaultValue: 0 })
  totalSpent: number;

  @Field(() => Float, { defaultValue: 0 })
  averageRating: number;

  @Field(() => Float, { defaultValue: 0 })
  totalReviews: number;
}
