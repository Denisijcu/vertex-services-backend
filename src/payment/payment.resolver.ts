import { Resolver, Query, Mutation, Args, Context, Int, ID, ObjectType, Field } from '@nestjs/graphql';
import { UseGuards, BadRequestException } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { GqlAuthGuard } from '../auth/graphql-auth.guard';
import { Transaction, Wallet } from './payment.schema';

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
  async getMyWallet(@Context() context: any): Promise<Wallet> {
    const userId = context.req.user._id;
    return this.paymentService.getMyWallet(userId);
  }

  @Query(() => [Transaction])
  @UseGuards(GqlAuthGuard)
  async getMyTransactions(
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 50 }) limit: number,
    @Args('offset', { type: () => Int, nullable: true, defaultValue: 0 }) offset: number,
    @Context() context: any
  ): Promise<Transaction[]> {
    const userId = context.req.user._id;
    return this.paymentService.getMyTransactions(userId, limit, offset);
  }

  @Mutation(() => Transaction)
  @UseGuards(GqlAuthGuard)
  async createJobPayment(
    @Args('jobId', { type: () => ID }) jobId: string,
    @Context() context: any
  ): Promise<Transaction> {
    const userId = context.req.user._id;
    return this.paymentService.createJobPayment(jobId, userId);
  }

  @Mutation(() => Transaction)
  @UseGuards(GqlAuthGuard)
  async releasePayment(
    @Args('jobId', { type: () => ID }) jobId: string,
    @Context() context: any
  ): Promise<Transaction> {
    const userId = context.req.user._id;
    return this.paymentService.releasePayment(jobId, userId);
  }

  @Mutation(() => Transaction)
  @UseGuards(GqlAuthGuard)
  async withdrawFunds(
    @Args('amount') amount: number,
    @Context() context: any
  ): Promise<Transaction> {
    const userId = context.req.user._id;
    return this.paymentService.withdrawFunds(userId, amount);
  }

  @Mutation(() => String)
  @UseGuards(GqlAuthGuard)
  async getStripeOnboardingLink(@Context() context: any): Promise<string> {
    const userId = context.req.user._id;
    return this.paymentService.getStripeOnboardingLink(userId);
  }

  /**
   * 🔥 REFUND PAYMENT MUTATION - CORREGIDA
   * Retorna RefundResponse en lugar de Transaction
   */
  @Mutation(() => RefundResponse)
  @UseGuards(GqlAuthGuard)
  async refundPayment(
    @Args('jobId', { type: () => ID }) jobId: string,
    @Args('reason', { type: () => String, nullable: true }) reason: string,
    @Context() context: any
  ): Promise<RefundResponse> {
    const userId = context.req.user._id;

    if (!userId) {
      throw new BadRequestException('Usuario no autenticado');
    }

    return this.paymentService.refundPayment(
      jobId,
      userId,
      reason,
      false // No es admin override
    );
  }

  /**
   * 🔥 FORCE REFUND MUTATION - CORREGIDA (Solo Admin)
   */
  @Mutation(() => RefundResponse)
  @UseGuards(GqlAuthGuard)
  async forceRefund(
    @Args('jobId', { type: () => ID }) jobId: string,
    @Args('reason', { type: () => String }) reason: string,
    @Context() context: any
  ): Promise<RefundResponse> {
    const userId = context.req.user._id;

    if (!userId) {
      throw new BadRequestException('Usuario no autenticado');
    }

    const user = await this.paymentService['userModel'].findById(userId);

    if (!user || user.role !== 'ADMIN') {
      throw new BadRequestException('Solo administradores pueden forzar reembolsos');
    }

    return this.paymentService.refundPayment(
      jobId,
      userId,
      reason,
      true // Admin override
    );
  }

  @Mutation(() => String)
  @UseGuards(GqlAuthGuard)
  async getStripeConnectOnboardingLink(@Context() context: any): Promise<string> {
    const userId = context.req.user._id;
    console.log('🚀 Intentando generar link para el usuario:', userId);
    return this.paymentService.getStripeConnectOnboardingLink(userId);
  }

  @Query(() => String)
  @UseGuards(GqlAuthGuard)
  async getStripeAccountStatus(@Context() context: any): Promise<string> {
    const userId = context.req.user._id;
    const status = await this.paymentService.checkStripeAccountStatus(userId);
    return JSON.stringify(status);
  }
}