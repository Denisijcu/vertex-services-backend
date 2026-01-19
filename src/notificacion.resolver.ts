import { Resolver, Query, Context, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from './auth/graphql-auth.guard';
import { NotificationService } from './auth/notification.service';
import { Notification } from './notification.schema'; // Asegúrate de que apunte bien al schema

@Resolver(() => Notification)
export class NotificationResolver {
  constructor(private readonly notificationService: NotificationService) {}

  @Query(() => [Notification])
  @UseGuards(GqlAuthGuard)
  async getMyNotifications(@Context() context: any) {
   const userId = String(context.req.user._id); // 🔥 CLAV
    return this.notificationService.findByUser(userId);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async markNotificationAsRead(@Args('id') id: string) {
    // ✅ CORREGIDO: Llamamos al servicio, no al modelo inexistente
    return this.notificationService.markAsRead(id);
  }
}