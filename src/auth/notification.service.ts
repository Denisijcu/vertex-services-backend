import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose'; // 👈 Agregar Types
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
    console.log('🔍 Buscando notificaciones para userId:', userId);
    
    // 🔥 FIX: Convertir string a ObjectId
    const notifications = await this.notificationModel.find({ 
      recipientId: new Types.ObjectId(userId) // 👈 CONVERSIÓN CLAVE
    }).sort({ createdAt: -1 }).exec();
    
    console.log('📊 Notificaciones encontradas:', notifications.length);
    
    return notifications;
  }

  async markAsRead(id: string): Promise<boolean> {
    const result = await this.notificationModel.findByIdAndUpdate(
      id, 
      { isRead: true },
      { new: true }
    );
    return !!result;
  }
}
