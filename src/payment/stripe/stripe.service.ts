
import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor() {
  this.stripe = new Stripe(
    process.env.STRIPE_SECRET_KEY || ''
  );
}

  /**
   * Crear Payment Intent (para pagos de clientes)
   */
  async createPaymentIntent(amount: number, currency: string = 'usd'): Promise<Stripe.PaymentIntent> {
    return await this.stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe usa centavos
      currency,
      automatic_payment_methods: { enabled: true }
    });
  }

  /**
   * Crear transferencia a proveedor (cuando se completa trabajo)
   */
  async createTransfer(
    amount: number,
    stripeAccountId: string,
    jobId: string
  ): Promise<Stripe.Transfer> {
    return await this.stripe.transfers.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      destination: stripeAccountId,
      metadata: { jobId }
    });
  }

  /**
   * Crear cuenta conectada para proveedores
   */
  async createConnectedAccount(email: string): Promise<Stripe.Account> {
    return await this.stripe.accounts.create({
      type: 'express',
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true }
      }
    });
  }

  /**
   * Crear link de onboarding para proveedores
   */
  async createAccountLink(accountId: string, returnUrl: string, refreshUrl: string): Promise<Stripe.AccountLink> {
    return await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding'
    });
  }

  /**
   * Crear payout (retiro a cuenta bancaria)
   */
  async createPayout(amount: number, stripeAccountId: string): Promise<Stripe.Payout> {
    return await this.stripe.payouts.create(
      {
        amount: Math.round(amount * 100),
        currency: 'usd'
      },
      { stripeAccount: stripeAccountId }
    );
  }
}