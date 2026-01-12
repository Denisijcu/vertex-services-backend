import { BadRequestException, Injectable, NotFoundException, Logger, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Job, JobDocument } from '../job.schema';
import { User, UserDocument } from '../user.schema';
import { Transaction, TransactionDocument, TransactionStatus, TransactionType, Wallet, WalletDocument } from './payment.schema';
import { StripeService } from './stripe/stripe.service';
import { StripeConnectService } from '../webhook/stripe/stripe-connect.service';
import Stripe from 'stripe'; ''


import { NotificationService } from '../auth/notification.service';
import { UserService } from '../auth/user.service';

@Injectable()
export class PaymentService {
    private stripe: Stripe;
    private readonly logger = new Logger(PaymentService.name);
    constructor(
        @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
        @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
        @InjectModel(Job.name) private jobModel: Model<JobDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private stripeService: StripeService,
        private stripeConnectService: StripeConnectService,
        private userService: UserService,
        private notificationService: NotificationService,


    ) {

        this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    }

    /**
     * Obtener o crear wallet de usuario
     */
    async getOrCreateWallet(userId: string): Promise<Wallet> {
        const objectId = new Types.ObjectId(userId);

        let wallet = await this.walletModel.findOne({ userId: objectId });

        if (!wallet) {
            wallet = new this.walletModel({
                userId: objectId,
                availableBalance: 0,
                pendingBalance: 0,
                totalEarned: 0,
                totalSpent: 0,
                currency: 'USD'
            });
            await wallet.save();
        }

        return wallet;
    }

    /**
     * Obtener wallet del usuario
     */
    async getMyWallet(userId: string): Promise<Wallet> {
        return await this.getOrCreateWallet(userId);
    }

    /**
     * Obtener transacciones del usuario
     */
    async getMyTransactions(
        userId: string,
        limit: number = 50,
        offset: number = 0
    ): Promise<Transaction[]> {
        const objectId = new Types.ObjectId(userId);

        return await this.transactionModel
            .find({ userId: objectId })
            .sort({ createdAt: -1 })
            .skip(offset)
            .limit(limit)
            .lean();
    }

    /**
   * Crear Payment Intent cuando cliente acepta un job
   */
    async createJobPayment(jobId: string, clientId: string): Promise<Transaction> {
        const job = await this.jobModel.findById(jobId);
        if (!job) throw new NotFoundException('Job not found');

        const client = await this.userModel.findById(clientId);
        if (!client) throw new NotFoundException('Client not found');

        // Crear Payment Intent en Stripe
        const paymentIntent = await this.stripeService.createPaymentIntent(
            job.price,
            'usd'
        );

        // Crear transacción de pago enviado (cliente)
        const clientTransaction = new this.transactionModel({
            userId: new Types.ObjectId(clientId),
            jobId: new Types.ObjectId(jobId),
            type: TransactionType.PAYMENT_SENT,
            amount: -job.price,
            currency: 'USD',
            status: TransactionStatus.PENDING,
            stripePaymentIntentId: paymentIntent.id,
            description: `Payment for job: ${job.title}`
        });

        await clientTransaction.save();

        // Crear transacción en escrow (proveedor)
        const providerTransaction = new this.transactionModel({
            userId: job.provider?._id?.toString(),
            jobId: new Types.ObjectId(jobId),
            type: TransactionType.ESCROW_HOLD,
            amount: job.price,
            currency: 'USD',
            status: TransactionStatus.PENDING,
            stripePaymentIntentId: paymentIntent.id,
            description: `Escrow hold for job: ${job.title}`
        });

        await providerTransaction.save();

       

        // ✅ ARREGLO: Actualizar usando updateOne con $inc
        await this.walletModel.updateOne(
            { userId: job.provider?._id },
            { $inc: { pendingBalance: job.price } }
        );

        // Actualizar job con payment info
        // ✅ Actualizar job: payment info + cambiar status a IN_PROGRESS automáticamente
        await this.jobModel.updateOne(
            { _id: jobId },
            {
                $set: {
                    status: 'IN_PROGRESS', // 👈 AGREGAR ESTA LÍNEA
                    'payment.stripePaymentIntentId': paymentIntent.id,
                    'payment.status': 'PENDING',
                    'payment.amount': job.price
                }
            }
        );

        // ✅ Devolver también el clientSecret para el frontend
        return {
            ...clientTransaction.toObject(),
            clientSecret: paymentIntent.client_secret // 👈 AGREGAR ESTO
        } as any;
    }
    /**
     * Liberar pago cuando job se completa
     */
    async releasePayment(jobId: string): Promise<Transaction> {
        const job = await this.jobModel.findById(jobId);
        if (!job) throw new NotFoundException('Job not found');

        if (job.status !== 'COMPLETED') {
            throw new BadRequestException('Job must be completed before releasing payment');
        }

        // Obtener provider
        const provider = await this.userModel.findById(job.provider?._id.toString());
        if (!provider) throw new NotFoundException('Provider not found');

        // Calcular comisión de la plataforma
        const commissionRate = parseFloat(process.env.PLATFORM_COMMISSION_PERCENTAGE || '10') / 100;
        const commission = job.price * commissionRate;
        const providerAmount = job.price - commission;

        // Marcar transacción de escrow como completada
        await this.transactionModel.updateMany(
            {
                jobId: new Types.ObjectId(jobId),
                type: TransactionType.ESCROW_HOLD,
                status: TransactionStatus.PENDING
            },
            {
                $set: { status: TransactionStatus.COMPLETED }
            }
        );

        // 🔥 NUEVO: Si provider tiene cuenta de Stripe, hacer transfer real
        let stripeTransferId: string | undefined;

        if (provider.stripeConnectedAccountId && provider.stripeAccountComplete) {
            try {
                const transfer = await this.stripeConnectService.transferToConnectedAccount(
                    providerAmount,
                    provider.stripeConnectedAccountId,
                    jobId,
                    `Payment for job: ${job.title}`
                );
                stripeTransferId = transfer.id;
                console.log(`✅ Stripe transfer created: ${transfer.id} - $${providerAmount}`);
            } catch (error) {
                console.error('❌ Stripe transfer failed:', error);
                // Continuar con el proceso aunque falle el transfer
            }
        }

        // Crear transacción de liberación para proveedor
        const releaseTransaction = new this.transactionModel({
            userId: job.provider?._id?.toString(),
            jobId: new Types.ObjectId(jobId),
            type: TransactionType.ESCROW_RELEASE,
            amount: providerAmount,
            currency: 'USD',
            status: TransactionStatus.COMPLETED,
            stripeTransferId, // 👈 AGREGAR transfer ID
            description: `Payment released for job: ${job.title}`
        });

        await releaseTransaction.save();

        // Crear transacción de comisión
        const commissionTransaction = new this.transactionModel({
            userId: job.provider?._id?.toString(),
            jobId: new Types.ObjectId(jobId),
            type: TransactionType.COMMISSION,
            amount: -commission,
            currency: 'USD',
            status: TransactionStatus.COMPLETED,
            description: `Platform commission (${commissionRate * 100}%)`
        });

        await commissionTransaction.save();

        // Actualizar wallet del proveedor
        const wallet = await this.walletModel.findOne({ userId: job.provider?._id?.toString() });
        if (wallet) {
            wallet.pendingBalance -= job.price;
            wallet.availableBalance += providerAmount;
            wallet.totalEarned += providerAmount;
            await wallet.save();
        }

        // Actualizar job payment status
        await this.jobModel.updateOne(
            { _id: jobId },
            {
                $set: {
                    'payment.status': 'PAID',
                    'payment.paidAt': new Date()
                }
            }
        );

        return releaseTransaction;
    }

    /**
     * Retirar fondos a cuenta bancaria
     */
    async withdrawFunds(userId: string | Types.ObjectId, amount: number): Promise<Transaction> {
        const objectId = new Types.ObjectId(userId.toString());
        const wallet = await this.walletModel.findOne({ userId: objectId });
        if (!wallet || wallet.availableBalance < amount) {
            throw new BadRequestException('Fondos insuficientes en tu billetera de Vertex.');
        }

        const user = await this.userModel.findById(objectId);
        const activeStripeId = user?.stripeAccountId || user?.stripeConnectedAccountId;

        if (!activeStripeId) {
            throw new BadRequestException('Por favor, conecta tu cuenta de Stripe primero.');
        }

        try {
            // 💸 PASO CRÍTICO: Mover saldo de la Plataforma a la Cuenta Conectada
            // Esto soluciona el error de "Your card balance is too low"
            await this.stripeService.createTransfer(
                amount,
                activeStripeId,
                `Fondeo para retiro de usuario: ${userId}`
            );

            // 🏦 PASO 2: Ahora que la cuenta ACCT_... tiene saldo, ejecutamos el Payout
            const payout = await this.stripeService.createPayout(
                amount,
                activeStripeId
            );

            // 📝 Registro de transacciones y actualización de balance (tu lógica actual)
            const transaction = new this.transactionModel({
                userId: objectId,
                type: TransactionType.WITHDRAWAL,
                amount: -amount,
                currency: 'USD',
                status: TransactionStatus.COMPLETED,
                stripeTransferId: payout.id,
                description: `Retiro exitoso a cuenta bancaria: ${payout.destination}`
            });
            await transaction.save();

            await this.walletModel.updateOne(
                { userId: objectId },
                { $inc: { availableBalance: -amount } }
            );

            return transaction;
        } catch (error:any) {
            console.error('❌ Error en retiro:', error);
            throw new BadRequestException(`Stripe Error: ${error.message}`);
        }
    }
    /**
     * Crear cuenta de Stripe Connect para proveedor
     */
    async createStripeAccount(userId: string): Promise<string> {
        const user = await this.userModel.findById(userId);
        if (!user) throw new NotFoundException('User not found');

        if (user.stripeCustomerId) {
            return user.stripeCustomerId;
        }

        // Crear cuenta conectada en Stripe
        const account = await this.stripeService.createConnectedAccount(user.email);

        // Guardar en usuario
        user.stripeCustomerId = account.id;
        await user.save();

        return account.id;
    }

    /**
     * Obtener link de onboarding para Stripe
     */
    async getStripeOnboardingLink(userId: string): Promise<string> {
        const stripeAccountId = await this.createStripeAccount(userId);

        const returnUrl = `${process.env.FRONTEND_URL || 'http://localhost:4200'}/payments?setup=success`;
        const refreshUrl = `${process.env.FRONTEND_URL || 'http://localhost:4200'}/payments?setup=refresh`;

        const accountLink = await this.stripeService.createAccountLink(
            stripeAccountId,
            returnUrl,
            refreshUrl
        );

        return accountLink.url;
    }



    /**
 * Crear cuenta conectada de Stripe para provider
 */
    async createStripeConnectedAccount(userId: string): Promise<string> {
        const user = await this.userModel.findById(userId);
        if (!user) throw new NotFoundException('User not found');

        // Si ya tiene cuenta, devolverla
        if (user.stripeConnectedAccountId) {
            return user.stripeConnectedAccountId;
        }

        // Crear nueva cuenta conectada
        const account = await this.stripeConnectService.createConnectedAccount(
            user.email,
            user.name,
        );

        // Guardar en usuario
        user.stripeConnectedAccountId = account.id;
        await user.save();

        return account.id;
    }

    /**
     * Obtener link de onboarding para Stripe Connect
     */
    async getStripeConnectOnboardingLink(userId: string): Promise<string> {
        const accountId = await this.createStripeConnectedAccount(userId);

        const returnUrl = `${process.env.FRONTEND_URL || 'http://localhost:4200'}/payments?onboarding=success`;
        const refreshUrl = `${process.env.FRONTEND_URL || 'http://localhost:4200'}/payments?onboarding=refresh`;

        const accountLink = await this.stripeConnectService.createAccountLink(
            accountId,
            refreshUrl,
            returnUrl,
        );

        return accountLink.url;
    }

    /**
     * Verificar estado de cuenta conectada
     */
    /**
     * Verificar estado de cuenta conectada
     */
    async checkStripeAccountStatus(userId: string): Promise<{
        hasAccount: boolean;
        isComplete: boolean;
        accountId?: string;
    }> {
        const user = await this.userModel.findById(userId);

        // Si no tiene el ID, no tiene cuenta
        if (!user || !user.stripeConnectedAccountId) {
            return { hasAccount: false, isComplete: false };
        }

        // Consultamos a Stripe la realidad de la cuenta
        const isComplete = await this.stripeConnectService.isAccountComplete(
            user.stripeConnectedAccountId,
        );

        // ✅ CRÍTICO: Actualizamos los dos campos para que el Frontend se limpie
        await this.userModel.updateOne(
            { _id: userId },
            {
                $set: {
                    stripeAccountComplete: isComplete,
                    stripeAccountId: user.stripeConnectedAccountId // Sincronizamos ambos campos
                }
            }
        );

        return {
            hasAccount: true,
            isComplete,
            accountId: user.stripeConnectedAccountId,
        };
    }

    /**
   * ✅ CONFIRMAR PAGO DESDE WEBHOOK
   * Esta función busca la transacción pendiente y la completa
   */
    async confirmPayment(paymentIntentId: string) {
        // 1. Buscamos la transacción que creamos al inicio del job
        const transaction = await this.transactionModel.findOne({
            stripePaymentIntentId: paymentIntentId
        });

        if (!transaction) {
            throw new NotFoundException('Transaction not found for this PaymentIntent');
        }

        // 2. Si ya está completada, no hacemos nada más
        if (transaction.status === TransactionStatus.COMPLETED) return;

        // 3. Marcamos la transacción como completada
        transaction.status = TransactionStatus.COMPLETED;
        await transaction.save();

        // 4. Actualizamos el Job para que pase a IN_PROGRESS o PAID
        await this.jobModel.updateOne(
            { 'payment.stripePaymentIntentId': paymentIntentId },
            { $set: { 'payment.status': 'PAID', status: 'IN_PROGRESS' } }
        );

        return { success: true };
    }

    /**
   * 🛡️ REEMBOLSO LEGAL (REFUND)
   * Devuelve el dinero al cliente y actualiza el estado en Vertex Coders
   */
    /**
    * 💎 REFUND PROFESIONAL - NIVEL ENTERPRISE
    * Sistema completo con validaciones, penalizaciones y notificaciones
    */
    async refundPayment(
        jobId: string,
        requesterId: string,
        reason?: string,
        isAdminOverride: boolean = false
    ): Promise<any> {
        this.logger.log(`🔄 Iniciando refund para Job ${jobId} por usuario ${requesterId}`);

        // 1️⃣ VALIDAR QUE EL JOB EXISTE
        const job = await this.jobModel.findById(jobId);
        if (!job) {
            throw new NotFoundException('Job no encontrado en el sistema');
        }

        // 2️⃣ VALIDAR PERMISOS (Solo cliente o admin)
        const requester = await this.userModel.findById(requesterId);
        if (!requester) {
            throw new NotFoundException('Usuario no encontrado');
        }

        //const isClient = job.client._id.toString() === requesterId;
        const isClient = job.client._id.toString() === requesterId.toString();
        const isAdmin = requester.role === 'ADMIN';

        if (!isClient && !isAdmin) {
            throw new ForbiddenException('Solo el cliente o un administrador pueden solicitar un reembolso');
        }

        // 3️⃣ VALIDAR ESTADO DEL JOB
        if (job.status === 'COMPLETED' && !isAdminOverride) {
            throw new BadRequestException('No se puede reembolsar un trabajo completado. Contacta a soporte si hay un problema.');
        }

        if (job.status === 'CANCELLED') {
            throw new BadRequestException('Este trabajo ya fue cancelado previamente');
        }

        if (!job.payment?.stripePaymentIntentId) {
            throw new BadRequestException('No se encontró información de pago para este trabajo');
        }

        // 4️⃣ CALCULAR PORCENTAJE DE REEMBOLSO SEGÚN ESTADO
        let refundPercentage = 1.0; // 100% por defecto
        let refundReason = reason || 'Reembolso solicitado por el cliente';

        switch (job.status) {
            case 'PENDING_PAYMENT':
            case 'OPEN':
                refundPercentage = 1.0; // 100% - No comenzó
                refundReason = 'Trabajo no iniciado - Reembolso completo';
                break;

            case 'IN_PROGRESS':
                if (isAdminOverride) {
                    refundPercentage = 1.0; // Admin puede dar 100%
                } else {
                    refundPercentage = 0.5; // Cliente solo 50%
                    refundReason = 'Trabajo en progreso - Reembolso parcial (50%)';
                }
                break;

            case 'COMPLETED':
                if (!isAdminOverride) {
                    throw new BadRequestException('Trabajo completado. Solo un administrador puede procesar este reembolso.');
                }
                refundPercentage = 0.7; // Admin da 70% en completados
                refundReason = 'Reembolso administrativo - Trabajo completado';
                break;
        }

        const refundAmount = job.price * refundPercentage;
        const amountInCents = Math.round(refundAmount * 100);

        this.logger.log(`💰 Reembolsando ${refundPercentage * 100}% ($${refundAmount}) del total $${job.price}`);

        try {
            // 5️⃣ EJECUTAR REFUND EN STRIPE
            const refund = await this.stripe.refunds.create({
                payment_intent: job.payment.stripePaymentIntentId,
                amount: amountInCents,
                reason: 'requested_by_customer',
                metadata: {
                    jobId: jobId,
                    requesterId: requesterId.toString(),
                    refundPercentage: refundPercentage.toString(),
                    originalAmount: job.price.toString()
                }
            });

            this.logger.log(`✅ Refund exitoso en Stripe: ${refund.id}`);

            // 6️⃣ CREAR TRANSACCIÓN DE REFUND PARA EL CLIENTE
            const clientRefundTx = new this.transactionModel({
                userId: job.client._id,
                jobId: new Types.ObjectId(jobId),
                type: TransactionType.REFUND,
                amount: refundAmount,
                currency: 'USD',
                status: TransactionStatus.COMPLETED,
                stripeTransferId: refund.id,
                description: refundReason
            });
            await clientRefundTx.save();

            // 7️⃣ ACTUALIZAR WALLET DEL CLIENTE (devolver dinero)
            await this.walletModel.updateOne(
                { userId: job.client._id },
                { $inc: { totalSpent: -refundAmount } }
            );

            // 8️⃣ PENALIZACIÓN AL PROVIDER (si trabajo ya estaba en progreso)
            if (job.status === 'IN_PROGRESS') {
                const providerPenalty = job.price - refundAmount;

                // Crear transacción de penalización
                const penaltyTx = new this.transactionModel({
                    userId: job.provider?._id.toString(),
                    jobId: new Types.ObjectId(jobId),
                    type: TransactionType.COMMISSION,
                    amount: -providerPenalty,
                    currency: 'USD',
                    status: TransactionStatus.COMPLETED,
                    description: `Penalización por cancelación de trabajo en progreso`
                });
                await penaltyTx.save();

                // Quitar del balance pendiente del provider
                await this.walletModel.updateOne(
                    { userId: job.provider?._id.toString() },
                    {
                        $inc: {
                            pendingBalance: -job.price,
                            totalEarned: providerPenalty // Dar algo al provider por tiempo invertido
                        }
                    }
                );

                this.logger.warn(`⚠️ Provider penalizado: $${providerPenalty} retenido`);
            }

            // 9️⃣ ACTUALIZAR ESTADO DEL JOB
            await this.jobModel.updateOne(
                { _id: jobId },
                {
                    $set: {
                        status: 'CANCELLED',
                        'payment.status': 'REFUNDED',
                        'payment.refundedAt': new Date(),
                        cancellationReason: refundReason
                    }
                }
            );

            // 🔟 NOTIFICACIONES A AMBAS PARTES
            await this.notificationService.create({
                recipientId: job.client._id.toString(),
                message: `✅ Reembolso procesado: $${refundAmount.toFixed(2)} será devuelto en 5-10 días hábiles`,
                jobId: new Types.ObjectId(jobId),
                type: 'REFUND_PROCESSED'
            });

            await this.notificationService.create({
                recipientId: job.provider?._id.toString(),
                message: `⚠️ El trabajo "${job.title}" fue cancelado. Reembolso procesado al cliente.`,
                jobId: new Types.ObjectId(jobId),
                type: 'JOB_CANCELLED'
            });

            // 1️⃣1️⃣ ACTUALIZAR STATS DE USUARIOS
            if (job.status === 'IN_PROGRESS') {
                // Decrementar trabajos del provider
                let providerId  = job.provider?._id.toString() || '';
                await this.userService.updateStats(providerId, {
                    'stats.jobsReceived': -1
                });
            }

            this.logger.log(`🎉 Refund completado exitosamente para Job ${jobId}`);

            
            return {
                success: true,
                refundAmount,
                refundPercentage: refundPercentage * 100,
                refundId: refund.id,
                transactionId: clientRefundTx._id.toString(), // ✅ ESTO DEBE TENER UN VALOR
                message: `Reembolso de $${refundAmount.toFixed(2)} procesado exitosamente`,
                estimatedArrival: '5-10 días hábiles'
            };

        } catch (error: any) {
            this.logger.error(`❌ Error procesando refund: ${error.message}`, error.stack);

            // Registrar error en base de datos
            const errorTx = new this.transactionModel({
                userId: job.client._id,
                jobId: new Types.ObjectId(jobId),
                type: TransactionType.REFUND,
                amount: refundAmount,
                currency: 'USD',
                status: TransactionStatus.FAILED,
                description: `Error en refund: ${error.message}`
            });
            await errorTx.save();

            throw new BadRequestException(`Error procesando reembolso: ${error.message}`);
        }
    }

    /**
     * 🔍 HELPER: Obtener job completo para refund
     */
    async getJobForRefund(jobId: string) {
        const job = await this.jobModel.findById(jobId)
            .select('payment.stripePaymentIntentId status price client provider title');

        if (!job) {
            throw new NotFoundException('Job no encontrado');
        }

        return job;
    }

    /**
   * ⚠️ MANEJO DE DISPUTAS (Nivel DIOS)
   * Bloquea el dinero si un cliente reclama al banco para que el provider no lo retire.
   */
    async handleDispute(paymentIntentId: string) {
        this.logger.warn(`⚠️ Processing dispute for PaymentIntent: ${paymentIntentId}`);

        // 1. Buscamos el Job relacionado (usando el campo exacto de tu esquema)
        const job = await this.jobModel.findOne({ 'payment.stripePaymentIntentId': paymentIntentId });

        if (!job) {
            this.logger.error(`❌ No job found for PaymentIntent: ${paymentIntentId}`);
            return;
        }

        // 2. Actualizamos el Job y el estado del pago directamente en la DB
        // Usamos cast 'as any' si tu Interface de Job aún no tiene 'DISPUTED' en los enums
        await this.jobModel.updateOne(
            { _id: job._id },
            {
                $set: {
                    status: 'DISPUTED' as any,
                    'payment.status': 'DISPUTED' as any
                }
            }
        );

        // 3. Creamos la transacción de congelamiento
        const disputeTx = new this.transactionModel({
            userId: job.provider?._id.toString(), // Asegúrate de si es job.provider o job.providerId
            jobId: job._id,
            type: TransactionType.ESCROW_HOLD,
            amount: -job.price,
            currency: 'USD',
            status: TransactionStatus.PENDING,
            description: `FONDOS CONGELADOS: Disputa bancaria iniciada por el cliente.`
        });
        await disputeTx.save();

        // 4. Bloqueamos el dinero en el Wallet
        await this.walletModel.updateOne(
            { userId: job.provider?._id.toString() },
            { $inc: { availableBalance: -(job.price * 0.9) } }
        );

        this.logger.error(`🛑 Funds frozen for Provider due to dispute.`);
    }

    /**
     * 🔄 RECONCILIACIÓN DE BALANCE
     * Verifica que lo que dice Stripe coincida con lo que dice MongoDB
     */
    async syncBalanceWithStripe(userId: string) {
        try {
            const user = await this.userModel.findById(userId);
            // Verificamos que el usuario exista y tenga cuenta de Stripe vinculada
            if (!user || !(user as any).stripeConnectId) {
                this.logger.warn(`⚠️ User ${userId} has no Stripe Connect ID`);
                return null;
            }

            const balance = await this.stripe.balance.retrieve({
                stripeAccount: (user as any).stripeConnectId,
            });

            // Sumamos el balance disponible (Available)
            let available = 0;
            balance.available.forEach(b => {
                if (b.currency === 'usd') available += b.amount;
            });

            // Sumamos el balance pendiente (Pending)
            let pending = 0;
            balance.pending.forEach(b => {
                if (b.currency === 'usd') pending += b.amount;
            });

            // Convertimos de centavos a dólares
            const finalAvailable = available / 100;
            const finalPending = pending / 100;

            // Actualizamos MongoDB con los valores reales de Stripe
            await this.walletModel.updateOne(
                { userId },
                {
                    $set: {
                        availableBalance: finalAvailable,
                        pendingBalance: finalPending,
                        lastSyncAt: new Date()
                    }
                },
                { upsert: true } // Por si el usuario no tiene Wallet creada aún
            );

            this.logger.log(`🔄 Balance synced for user ${userId}: \$${finalAvailable} Avail / \$${finalPending} Pend`);

            return { available: finalAvailable, pending: finalPending };
        } catch (error: any) {
            this.logger.error(`❌ Sync Balance Error: ${error.message}`);
            return null;
        }
    }


}