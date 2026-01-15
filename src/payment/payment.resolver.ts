import { Resolver, Query, Mutation, Args, Int, ID, ObjectType, Field } from '@nestjs/graphql';
import { UseGuards, BadRequestException } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { GqlAuthGuard } from '../auth/graphql-auth.guard';
import { Transaction, Wallet } from './payment.schema';
import { CurrentUser } from '../app.resolver';

/**
 * 🔥 NUEVO: Tipo para respuesta de refund
 */
@ObjectType()
export class RefundResponse {
  @Field()
  success: boolean;

  @Field()
  refundAmount: number;

  @Field()
  refundPercentage: number;

  @Field()
  refundId: string;

  @Field()
  transactionId: string;

  @Field()
  message: string;

  @Field()
  estimatedArrival: string;
}

@Resolver()
export class PaymentResolver {
  constructor(private paymentService: PaymentService) { }

  @Query(() => Wallet)
  @UseGuards(GqlAuthGuard)
  async getMyWallet(@CurrentUser() user: any): Promise<Wallet> {
    try {
      return await this.paymentService.getMyWallet(user._id);
    } catch (error: any) {
      console.error('❌ Wallet error:', error?.message);
      throw new BadRequestException(error?.message || 'Error loading wallet');
    }
  }

  @Query(() => [Transaction])
  @UseGuards(GqlAuthGuard)
  async getMyTransactions(
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 50 }) limit: number,
    @Args('offset', { type: () => Int, nullable: true, defaultValue: 0 }) offset: number,
    @CurrentUser() user: any
  ): Promise<Transaction[]> {
    try {
      return await this.paymentService.getMyTransactions(user._id, limit, offset);
    } catch (error: any) {
      console.error('❌ Transactions error:', error?.message);
      return [];
    }
  }

  @Mutation(() => Transaction)
  @UseGuards(GqlAuthGuard)
  async createJobPayment(
    @Args('jobId', { type: () => ID }) jobId: string,
    @CurrentUser() user: any
  ): Promise<Transaction> {
    try {
      return await this.paymentService.createJobPayment(jobId, user._id);
    } catch (error: any) {
      throw new BadRequestException(error?.message || 'Error creating payment');
    }
  }

  @Mutation(() => Transaction)
  @UseGuards(GqlAuthGuard)
  async releasePayment(
    @Args('jobId', { type: () => ID }) jobId: string
  ): Promise<Transaction> {
    try {
      return await this.paymentService.releasePayment(jobId);
    } catch (error: any) {
      throw new BadRequestException(error?.message || 'Error releasing payment');
    }
  }

  @Mutation(() => Transaction)
  @UseGuards(GqlAuthGuard)
  async withdrawFunds(
    @Args('amount') amount: number,
    @CurrentUser() user: any
  ): Promise<Transaction> {
    try {
      return await this.paymentService.withdrawFunds(user._id, amount);
    } catch (error: any) {
      throw new BadRequestException(error?.message || 'Error withdrawing funds');
    }
  }

  @Mutation(() => String)
  @UseGuards(GqlAuthGuard)
  async getStripeOnboardingLink(@CurrentUser() user: any): Promise<string> {
    try {
      return await this.paymentService.getStripeOnboardingLink(user._id);
    } catch (error: any) {
      throw new BadRequestException(error?.message || 'Error generating link');
    }
  }

  @Mutation(() => RefundResponse)
  @UseGuards(GqlAuthGuard)
  async refundPayment(
    @Args('jobId', { type: () => ID }) jobId: string,
    @Args('reason', { type: () => String, nullable: true }) reason: string,
    @CurrentUser() user: any
  ): Promise<RefundResponse> {
    try {
      return await this.paymentService.refundPayment(jobId, user._id, reason, false);
    } catch (error: any) {
      throw new BadRequestException(error?.message || 'Error refunding payment');
    }
  }

  @Mutation(() => String)
  @UseGuards(GqlAuthGuard)
  async getStripeConnectOnboardingLink(@CurrentUser() user: any): Promise<string> {
    try {
      console.log('🚀 Generating link for user:', user._id);
      return await this.paymentService.getStripeConnectOnboardingLink(user._id);
    } catch (error: any) {
      throw new BadRequestException(error?.message || 'Error generating connect link');
    }
  }

  @Query(() => String)
  @UseGuards(GqlAuthGuard)
  async getStripeAccountStatus(@CurrentUser() user: any): Promise<string> {
    try {
      const status = await this.paymentService.checkStripeAccountStatus(user._id);
      return JSON.stringify(status);
    } catch (error: any) {
      console.error('❌ Stripe status error:', error?.message);
      return JSON.stringify({ status: 'error', message: error?.message });
    }
  }
}