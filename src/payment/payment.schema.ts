import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Field, ObjectType, ID, registerEnumType } from '@nestjs/graphql';

export enum TransactionType {
    PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
    PAYMENT_SENT = 'PAYMENT_SENT',
    WITHDRAWAL = 'WITHDRAWAL',
    REFUND = 'REFUND',
    COMMISSION = 'COMMISSION',
    ESCROW_HOLD = 'ESCROW_HOLD',
    ESCROW_RELEASE = 'ESCROW_RELEASE'
}

export enum TransactionStatus {
    PENDING = 'PENDING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    CANCELLED = 'CANCELLED'
}

registerEnumType(TransactionType, { name: 'TransactionType' });
registerEnumType(TransactionStatus, { name: 'TransactionStatus' });

@ObjectType()
@Schema({ timestamps: true })
export class Transaction {
    @Field(() => ID)
    _id: Types.ObjectId;

    @Field(() => ID)
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    userId: Types.ObjectId;

    @Field(() => ID, { nullable: true })
    @Prop({ type: Types.ObjectId, ref: 'Job' })
    jobId?: Types.ObjectId;

    @Field(() => TransactionType)
    @Prop({ type: String, enum: TransactionType, required: true })
    type: TransactionType;

    @Field()
    @Prop({ required: true })
    amount: number;

    @Field()
    @Prop({ default: 'USD' })
    currency: string;

    @Field(() => TransactionStatus)
    @Prop({ type: String, enum: TransactionStatus, default: TransactionStatus.PENDING })
    status: TransactionStatus;

    @Field({ nullable: true })
    @Prop()
    stripeTransferId?: string;

    @Field({ nullable: true })
    @Prop()
    stripePaymentIntentId?: string;

    @Field({ nullable: true })
    @Prop()
    description?: string;

    @Field({ nullable: true })  // 👈 AGREGADO
    @Prop()
    clientSecret?: string;

    @Field()
    @Prop({ default: Date.now })
    createdAt: Date;

    @Field()
    @Prop({ default: Date.now })
    updatedAt: Date;
}

export type TransactionDocument = Transaction & Document;
export const TransactionSchema = SchemaFactory.createForClass(Transaction);

@ObjectType()
@Schema({ timestamps: true })
export class Wallet {
    @Field(() => ID)
    _id: Types.ObjectId;

    @Field(() => ID)
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
    userId: Types.ObjectId;

    @Field()
    @Prop({ default: 0 })
    availableBalance: number;

    @Field()
    @Prop({ default: 0 })
    pendingBalance: number;

    @Field()
    @Prop({ default: 0 })
    totalEarned: number;

    @Field()
    @Prop({ default: 0 })
    totalSpent: number;

    @Field()
    @Prop({ default: 'USD' })
    currency: string;

    @Field()
    @Prop({ default: Date.now })
    createdAt: Date;

    @Field()
    @Prop({ default: Date.now })
    updatedAt: Date;

    
}

export type WalletDocument = Wallet & Document;
export const WalletSchema = SchemaFactory.createForClass(Wallet);