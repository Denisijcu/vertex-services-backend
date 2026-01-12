import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ObjectType, Field, ID, Float, registerEnumType } from '@nestjs/graphql';

// ============================================
// 1. REGISTRO DE ENUMS PARA GRAPHQL
// ============================================
export enum JobStatus {
  OPEN = 'OPEN',
  PENDING_PAYMENT = 'PENDING_PAYMENT', // 👈 AGREGAR ESTE
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  DISPUTED = 'DISPUTED'
}
registerEnumType(JobStatus, { name: 'JobStatus' });

export enum ServiceCategory {
  MAINTENANCE = 'MAINTENANCE',
  REPAIR = 'REPAIR',
  ASSEMBLY = 'ASSEMBLY',
  CLEANING = 'CLEANING',
  TRANSPORTATION = 'TRANSPORTATION',
  TECHNICAL_SUPPORT = 'TECHNICAL_SUPPORT',
  DESIGN = 'DESIGN',
  CONSULTING = 'CONSULTING',
  TRAINING = 'TRAINING',
  OTHER = 'OTHER'
}
registerEnumType(ServiceCategory, { name: 'ServiceCategory' });

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  REFUNDED = 'REFUNDED',
  FAILED = 'FAILED'
}
registerEnumType(PaymentStatus, { name: 'PaymentStatus' });

// ============================================
// 2. SUB-SCHEMAS (Modelos de soporte)
// ============================================
@ObjectType('JobUserInfo')
export class UserInfo {
  @Field(() => ID)
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  _id: Types.ObjectId;

  @Field()
  @Prop({ required: true })
  name: string;

  @Field()
  @Prop({ required: true })
  email: string;

  @Field({ nullable: true })
  @Prop()
  avatar?: string;

  @Field({ nullable: true })
  @Prop()
  bio?: string;

  @Field({ nullable: true })
  @Prop()
  provider?:string;

  @Field({ nullable: true })
  @Prop()
  client?:string;
}



@ObjectType()
export class Payment {
  @Field(() => PaymentStatus)
  @Prop({ type: String, enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Field(() => Float)
  @Prop()
  amount: number;

  @Field({ nullable: true }) @Prop() stripePaymentIntentId?: string;
  @Field({ nullable: true }) @Prop() stripeChargeId?: string;
  @Field({ nullable: true }) @Prop() paidAt?: Date;
  @Field({ nullable: true }) @Prop() refundedAt?: Date;
}

@ObjectType()
export class Review {
  @Field(() => ID)
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  reviewerId: Types.ObjectId;

  @Field()
  @Prop({ required: true })
  reviewerName: string;

  @Field(() => Float)
  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Field({ nullable: true })
  @Prop()
  comment?: string;

  @Field()
  @Prop({ default: Date.now })
  createdAt: Date;
}

@ObjectType()
export class Message {
  @Field(() => ID)
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  senderId: Types.ObjectId;

  @Field()
  @Prop({ required: true })
  senderName: string;

  @Field()
  @Prop({ required: true })
  text: string;

  @Field()
  @Prop({ default: Date.now })
  timestamp: Date;
}

// ============================================
// 3. JOB SCHEMA (Entidad Principal)
// ============================================
@ObjectType()
@Schema({ timestamps: true })
export class Job {
  @Field(() => ID)
  _id: string;

  @Field()
  @Prop({ required: true, trim: true, minlength: 3 })
  title: string;

  @Field()
  @Prop({ required: true, trim: true })
  description: string;

  @Field(() => Float)
  @Prop({ required: true, min: 0 })
  price: number;

  @Field()
  @Prop({ required: true, trim: true })
  location: string;

  @Field(() => ServiceCategory)
  @Prop({ type: String, enum: ServiceCategory })
  category: ServiceCategory;

  @Field(() => JobStatus)
  @Prop({ type: String, enum: JobStatus, default: JobStatus.OPEN })
  status: JobStatus;

  @Field(() => UserInfo)
  @Prop({ type: UserInfo, required: true })
  client: UserInfo;

  @Field(() => UserInfo, { nullable: true })
  @Prop({ type: UserInfo })
  provider?: UserInfo;

  @Field(() => [String], { nullable: 'items' })
  @Prop({ type: [String], default: [] })
  images?: string[];

  @Field({ nullable: true }) @Prop() deadline?: Date;

  @Field(() => Payment, { nullable: true })
  @Prop({ type: Payment })
  payment?: Payment;

  @Field(() => Review, { nullable: true })
  @Prop({ type: Review })
  clientReview?: Review;

  @Field(() => Review, { nullable: true })
  @Prop({ type: Review })
  providerReview?: Review;

  @Field(() => [Message], { nullable: 'items' })
  @Prop({ type: [Message], default: [] })
  messages?: Message[];

  @Field({ nullable: true }) @Prop() acceptedAt?: Date;
  @Field({ nullable: true }) @Prop() completedAt?: Date;
  @Field({ nullable: true }) @Prop() cancelledAt?: Date;
  @Field({ nullable: true }) @Prop() cancellationReason?: string;

  @Field(() => Float)
  @Prop({ default: 0 })
  views: number;

  @Field(() => [String], { nullable: 'items' })
  @Prop({ type: [String], default: [] })
  tags?: string[];
}

export type JobDocument = Job & Document;
export const JobSchema = SchemaFactory.createForClass(Job);

// Índices para máxima velocidad
JobSchema.index({ status: 1 });
JobSchema.index({ category: 1 });
JobSchema.index({ 'client._id': 1 });
JobSchema.index({ 'provider._id': 1 });
JobSchema.index({ title: 'text', description: 'text' });