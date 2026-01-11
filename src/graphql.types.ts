import { ObjectType, Field, ID, Float, InputType } from '@nestjs/graphql';

// ============================================
// TIPOS DE OBJETOS (ObjectType)
// ============================================

@ObjectType()
export class ServiceOfferedType {
  @Field()
  category: string;

  @Field()
  title: string;

  @Field()
  description: string;

  @Field(() => Float)
  pricePerHour: number;

  @Field()
  isActive: boolean;
}

@ObjectType()
export class SocialLinksType {
  @Field({ nullable: true })
  linkedin?: string;

  @Field({ nullable: true })
  twitter?: string;

  @Field({ nullable: true })
  instagram?: string;

  @Field({ nullable: true })
  github?: string;

  @Field({ nullable: true })
  facebook?: string;
}

@ObjectType()
export class StatsType {
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

@ObjectType()
export class TwoFactorAuthType {
  @Field()
  enabled: boolean;
}

@ObjectType()
export class UserType {
  @Field(() => ID)
  _id: string;

  @Field()
  name: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  avatar?: string;

  @Field({ nullable: true })
  bio?: string;

  @Field({ nullable: true })
  location?: string;
}

@ObjectType()
export class UserProfileType {
  @Field(() => ID)
  _id: string;

  @Field()
  name: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  bio?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  location?: string;

  @Field()
  role: string;

  @Field({ nullable: true })
  avatar?: string;

  @Field(() => [String], { nullable: true })
  gallery?: string[];

  @Field(() => [ServiceOfferedType], { nullable: true })
  servicesOffered?: ServiceOfferedType[];

  @Field(() => SocialLinksType, { nullable: true })
  socialLinks?: SocialLinksType;

  @Field(() => StatsType, { nullable: true })
  stats?: StatsType;

  @Field()
  emailVerified: boolean;

  @Field()
  isActive: boolean;

  @Field({ nullable: true })
  lastLogin?: string;

  @Field(() => TwoFactorAuthType, { nullable: true })
  twoFactorAuth?: TwoFactorAuthType;
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

  @Field()
  category: string;

  @Field()
  status: string;

  @Field(() => UserType, { nullable: true })
  client?: UserType;

  @Field(() => UserType, { nullable: true })
  provider?: UserType;

  @Field()
  createdAt: string;

  @Field({ nullable: true })
  acceptedAt?: string;

  @Field({ nullable: true })
  completedAt?: string;
}

// ============================================
// TIPOS DE RESPUESTA (Response Types)
// ============================================

@ObjectType()
export class AuthResponse {
  @Field()
  access_token: string;

  @Field(() => UserProfileType)
  user: UserProfileType;
}

@ObjectType()
export class LoginResponse {
  @Field({ nullable: true })
  access_token?: string;

  @Field({ nullable: true })
  requiresTwoFactor?: boolean;

  @Field({ nullable: true })
  message?: string;

  @Field(() => UserProfileType, { nullable: true })
  user?: UserProfileType;
}

@ObjectType()
export class MessageResponse {
  @Field()
  message: string;

  @Field({ nullable: true })
  emailVerificationToken?: string;
}

@ObjectType()
export class TwoFactorSetupResponse {
  @Field()
  qrCode: string;

  @Field()
  secret: string;

  @Field(() => [String])
  backupCodes: string[];
}

// ============================================
// TIPOS DE ENTRADA (InputType)
// ============================================

@InputType()
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
}

@InputType()
export class UpdateProfileInput {
  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  bio?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  location?: string;

  @Field({ nullable: true })
  avatar?: string;
}

@InputType()
export class ServiceInput {
  @Field()
  category: string;

  @Field()
  title: string;

  @Field()
  description: string;

  @Field(() => Float)
  pricePerHour: number;
}

@InputType()
export class SocialLinksInput {
  @Field({ nullable: true })
  linkedin?: string;

  @Field({ nullable: true })
  twitter?: string;

  @Field({ nullable: true })
  instagram?: string;

  @Field({ nullable: true })
  github?: string;

  @Field({ nullable: true })
  facebook?: string;
}

@InputType()
export class RegisterInput {
  @Field()
  email: string;

  @Field()
  password: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  role?: string;
}

@InputType()
export class LoginInput {
  @Field()
  email: string;

  @Field()
  password: string;

  @Field({ nullable: true })
  twoFactorCode?: string;
}

@InputType()
export class VerifyEmailInput {
  @Field()
  token: string;
}

@InputType()
export class TwoFactorCodeInput {
  @Field()
  code: string;
}

@InputType()
export class ForgotPasswordInput {
  @Field()
  email: string;
}