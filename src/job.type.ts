import { ObjectType, Field, ID, Float, Enum } from '@nestjs/graphql';
import { JobStatus, ServiceCategory, PaymentStatus } from './job.schema';

@ObjectType('JobUserInfo')
export class UserInfoType {
  @Field(() => ID)
  _id: string;

  @Field()
  name: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  avatar?: string;
}

@ObjectType()
export class PaymentType {
  @Field(() => PaymentStatus)
  status: PaymentStatus;

  @Field(() => Float)
  amount: number;

  @Field({ nullable: true })
  stripePaymentIntentId?: string;

  @Field({ nullable: true })
  stripeChargeId?: string;

  @Field({ nullable: true })
  paidAt?: Date;

  @Field({ nullable: true })
  refundedAt?: Date;
}

@ObjectType()
export class JobType {
  @Field(() => ID)
  _id: string;

  @Field()
  title: string;

  @Field()
  description: string;

  @Field(() => Float)
  price: number;

  @Field()
  location: string;

  @Field(() => ServiceCategory)
  category: ServiceCategory;

  @Field(() => JobStatus)
  status: JobStatus;

  @Field(() => UserInfoType)
  client: UserInfoType;

  @Field(() => UserInfoType, { nullable: true })
  provider?: UserInfoType;

  @Field(() => [String], { nullable: 'items' })
  images?: string[];

  @Field({ nullable: true })
  deadline?: Date;

  @Field(() => PaymentType, { nullable: true })
  payment?: PaymentType;

  @Field({ nullable: true })
  acceptedAt?: Date;

  @Field({ nullable: true })
  completedAt?: Date;

  @Field(() => Float)
  views: number;

  @Field({ nullable: true })
  createdAt?: Date;

  @Field({ nullable: true })
  updatedAt?: Date;
}
