
import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class StripeConnectService {
  private stripe: Stripe;

 constructor() {
  this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!); // 👈 SIN apiVersion
}
  /**
   * Crear Express Connected Account para un provider
   */
  async createConnectedAccount(email: string, name: string): Promise<Stripe.Account> {
    const account = await this.stripe.accounts.create({
      type: 'express',
      email,
      business_type: 'individual',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_profile: {
        mcc: '7299', // Service providers
        name: name,
      },
    });

    return account;
  }

  /**
   * Generar Account Link para onboarding
   */
  async createAccountLink(
    accountId: string,
    refreshUrl: string,
    returnUrl: string,
  ): Promise<Stripe.AccountLink> {
    const accountLink = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return accountLink;
  }

  /**
   * Verificar si cuenta está completamente configurada
   */
/**
 * Verificar si cuenta está completamente configurada
 * Blindaje Nivel Dios para evitar caídas del sistema
 */
async isAccountComplete(accountId: string): Promise<boolean> {
  // Si te mandan el string vacío que pusiste, cortas aquí mismo
  if (!accountId) return false; 

  try {
    const account = await this.stripe.accounts.retrieve(accountId);
    return account.charges_enabled && account.payouts_enabled;
  } catch (error) {
    return false;
  }
}

  /**
   * Obtener detalles de la cuenta
   */
  async getAccount(accountId: string): Promise<Stripe.Account> {
    return await this.stripe.accounts.retrieve(accountId);
  }

  /**
   * Transferir dinero a cuenta conectada
   */
  async transferToConnectedAccount(
    amount: number,
    destinationAccountId: string,
    transferGroup: string,
    description: string,
  ): Promise<Stripe.Transfer> {
    const transfer = await this.stripe.transfers.create({
      amount: Math.round(amount * 100), // Convertir a centavos
      currency: 'usd',
      destination: destinationAccountId,
      transfer_group: transferGroup,
      description,
    });

    return transfer;
  }

  /**
   * Crear payout (retiro a banco)
   */
  async createPayout(
    amount: number,
    connectedAccountId: string,
  ): Promise<Stripe.Payout> {
    const payout = await this.stripe.payouts.create(
      {
        amount: Math.round(amount * 100),
        currency: 'usd',
      },
      {
        stripeAccount: connectedAccountId,
      },
    );

    return payout;
  }

  /**
   * Obtener balance de cuenta conectada
   */
  async getConnectedAccountBalance(accountId: string): Promise<Stripe.Balance> {
    return await this.stripe.balance.retrieve({
      stripeAccount: accountId,
    });
  }
}