import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification, NotificationDocument } from '../notification.schema';

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
  ) {}

  async create(data: any): Promise<NotificationDocument> {
    const notification = new this.notificationModel(data);
    return await notification.save();
  }

  async findByUser(userId: string) {
    return await this.notificationModel.find({ recipientId: userId }).sort({ createdAt: -1 }).exec();
  }

  async markAsRead(id: string): Promise<boolean> {
    const result = await this.notificationModel.findByIdAndUpdate(
      id, 
      { isRead: true },
      { new: true } // 👈 Esto devuelve el documento actualizado
    );
    return !!result; // 👈 Retorna true si encontró y actualizó, false si no existía
  }
}