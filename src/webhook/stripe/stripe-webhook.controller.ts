import {
  Controller,
  Post,
  Req,
  Headers,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import Stripe from 'stripe';
import { PaymentService } from '../../payment/payment.service'; // 👈 Asegúrate de que esta ruta sea la de tu servicio

@Controller('webhooks/stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);
  private stripe: Stripe;
  private webhookSecret: string;

  // ✅ Inyectamos el servicio sin romper el constructor
  constructor(private readonly paymentService: PaymentService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    
  }

  @Post()
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        req.rawBody!,
        signature,
        this.webhookSecret,
      );
    } catch (err: any) {
      this.logger.error('⚠️ Webhook signature verification failed', err.message);
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }

    // 🚀 Manejo de eventos con lógica de base de datos
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await this.handlePaymentIntentSucceeded(paymentIntent);
        break;

      case 'payment_intent.payment_failed':
        this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case 'transfer.created':
        this.handleTransferCreated(event.data.object as Stripe.Transfer);
        break;

      case 'payout.paid':
        this.handlePayoutPaid(event.data.object as Stripe.Payout);
        break;

      case 'payout.failed':
        this.handlePayoutFailed(event.data.object as Stripe.Payout);
        break;

      case 'charge.refunded': // 👈 NUEVO: Stripe confirma que el dinero ya va de regreso al cliente
        const refundData = event.data.object as Stripe.Charge;
        this.logger.log(`↩️ Refund processed for charge: ${refundData.id}`);
        // Aquí podrías llamar a una función de notificación para el cliente
        break;

      case 'charge.dispute.created': // 👈 NIVEL DIOS: Alerta legal si un cliente te reclama al banco
        const dispute = event.data.object as Stripe.Dispute;
        this.logger.error(`⚠️ DISPUTA CREADA: El cliente reclamó el pago ${dispute.payment_intent}`);
        // Marcar el Job automáticamente como 'DISPUTED' para bloquear fondos
        await this.paymentService.handleDispute(dispute.payment_intent as string);
        break;

      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
  }

  // 💰 Esta es la función que actualiza tu balance de $144.00 automáticamente
  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    this.logger.log(`✅ Payment succeeded: ${paymentIntent.id}`);
    try {
      // Llamamos al método que ya existe en tu servicio para marcar como PAID y mover el dinero en Mongo
      await this.paymentService.confirmPayment(paymentIntent.id);
      this.logger.log(`📊 MongoDB updated for payment ${paymentIntent.id}`);
    } catch (error:any) {
      this.logger.error(`❌ Error updating DB for payment ${paymentIntent.id}: ${error.message}`);
    }
  }

  private handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
    this.logger.error(`❌ Payment failed: ${paymentIntent.id}`);
  }

  private handleTransferCreated(transfer: Stripe.Transfer) {
    this.logger.log(`💸 Transfer created: ${transfer.id} - $${transfer.amount / 100}`);
  }

  private handlePayoutPaid(payout: Stripe.Payout) {
    this.logger.log(`💰 Payout paid: ${payout.id} - $${payout.amount / 100}`);
  }

  private handlePayoutFailed(payout: Stripe.Payout) {
    this.logger.error(`❌ Payout failed: ${payout.id}`);
  }
}