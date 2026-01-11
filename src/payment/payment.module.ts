
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Job, JobSchema } from '../job.schema';
import { User, UserSchema } from '../user.schema';
import { StripeConnectService } from '../webhook/stripe/stripe-connect.service';
import { StripeWebhookController } from '../webhook/stripe/stripe-webhook.controller';
import { PaymentResolver } from './payment.resolver';
import { Transaction, TransactionSchema, Wallet, WalletSchema } from './payment.schema';
import { PaymentService } from './payment.service';
import { StripeService } from './stripe/stripe.service';

import { Notification, NotificationSchema } from '../notification.schema'; // 👈 AGREGAR
import { NotificationService } from '../auth/notification.service'; // 👈 AGREGAR
import { UserService } from '../auth/user.service'; // 👈 AGREGAR

import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Transaction.name, schema: TransactionSchema },
            { name: Wallet.name, schema: WalletSchema },
            { name: Job.name, schema: JobSchema },
            { name: User.name, schema: UserSchema },
            { name: Notification.name, schema: NotificationSchema },
        ]),
        AuthModule,
    ],
    controllers: [StripeWebhookController],
    providers: [
        PaymentService,
        PaymentResolver,
        StripeService,
        UserService,
        StripeConnectService,
        NotificationService,
    ],
    exports: [PaymentService, StripeService]
})
export class PaymentModule { }