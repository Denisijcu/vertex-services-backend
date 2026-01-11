import { ObjectType, Field, Int, Float } from '@nestjs/graphql';
import { UserRole } from './user.schema';

@ObjectType()
export class UserInfoType {
  @Field()
  _id: string;

  @Field()
  name: string;

  @Field()
  email: string;

  @Field()
  role: UserRole;

  @Field()
  isActive: boolean;

  @Field({ nullable: true })
  avatar?: string;

  @Field({ nullable: true })
  bio?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  location?: string;

  @Field({ nullable: true })
  jobsCompleted?: number;

  @Field({ nullable: true })
  totalEarned?: number;
}
