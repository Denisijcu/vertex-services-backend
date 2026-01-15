import { ObjectType, Field, ID } from '@nestjs/graphql';
import { UserRole } from './user.schema';

// ============================================
// STATS DE USUARIO (para perfil)
// ============================================
@ObjectType()
export class UserStatsType {
  @Field()
  jobsCompleted: number;

  @Field()
  totalEarned: number;

  @Field()
  averageRating: number;

  @Field()
  totalReviews: number;
}

// ============================================
// INFO DE USUARIO
// ============================================
@ObjectType()
export class UserInfoType {
  @Field(() => ID)
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
  stripeAccountComplete?: boolean;

  @Field(() => UserStatsType, { nullable: true })
  stats?: UserStatsType;

  @Field({ nullable: true })
  createdAt?: string;

  @Field({ nullable: true })
  lastLogin?: string;
}

// ============================================
// STATS GENERALES (para admin)
// ============================================
@ObjectType()
export class GeneralStatsType {
  @Field()
  totalUsers: number;

  @Field()
  totalProviders: number;

  @Field()
  totalClients: number;

  @Field()
  activeUsers: number;

  @Field()
  totalEarnings: number;

  @Field()
  inEscrow: number;

  @Field()
  disputesCount: number;

  @Field()
  pendingPayments: number;

  @Field()
  completedJobs: number;

  @Field()
  cancelledJobs: number;
}