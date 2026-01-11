
@ObjectType()
class StatsType {
  @Field(() => Float)
  jobsCompleted: number;

  @Field(() => Float)
  jobsReceived: number;

  @Field(() => Float)
  totalEarned: number;

  @Field(() => Float)
  totalSpent: number;

  @Field(() => Float)
  averageRating: number;

  @Field(() => Float)
  totalReviews: number;
}
