import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from './message.schema';
import { ChatRoom, ChatRoomDocument } from './chat-room.schema';
import { Job, JobDocument } from './job.schema';
import { User, UserDocument } from './user.schema';
//import { UploadService } from './upload.service';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(ChatRoom.name) private chatRoomModel: Model<ChatRoomDocument>,
    @InjectModel(Job.name) private jobModel: Model<JobDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  
  ) { }

  /**
   * Crear o recuperar ChatRoom para un Job
   */
  async getOrCreateChatRoom(jobId: string): Promise<ChatRoom> {
    const objectId = new Types.ObjectId(jobId);

    let chatRoom = await this.chatRoomModel.findOne({ jobId: objectId });

    if (chatRoom) {
      return chatRoom;
    }

    // Obtener el Job para extraer participantes
    const job = await this.jobModel.findById(objectId).lean();
    if (!job) throw new Error('Job no encontrado');

    // Obtener datos de cliente y proveedor
    const client = await this.userModel.findById(job.client._id).lean();
    const provider = await this.userModel.findById(job.provider?._id).lean();

    if (!client || !provider) {
      throw new Error('Participantes del chat no encontrados');
    }

    // Crear ChatRoom
    chatRoom = new this.chatRoomModel({
      jobId: objectId,
      jobTitle: job.title,
      participants: [
        {
          _id: client._id,
          name: client.name,
          avatar: client.avatar,
          role: 'CLIENT',
          unreadCount: 0
        },
        {
          _id: provider._id,
          name: provider.name,
          avatar: provider.avatar,
          role: 'PROVIDER',
          unreadCount: 0
        }
      ]
    });

    return await chatRoom.save();
  }

  async getMyChats(userId: string): Promise<ChatRoom[]> {
    const objectId = new Types.ObjectId(userId);

    // Obtener todos los chats del usuario
    const allChats = await this.chatRoomModel
      .find({ 'participants._id': objectId })
      .sort({ updatedAt: -1 })
      .lean();

    // Eliminar duplicados - mantener solo el más reciente por jobId
    const uniqueChats = new Map();

    for (const chat of allChats) {
      const jobIdStr = chat.jobId.toString();

      if (!uniqueChats.has(jobIdStr)) {
        uniqueChats.set(jobIdStr, chat);
      }
      // Si ya existe, el más reciente ya está primero por el sort
    }

    return Array.from(uniqueChats.values());
  }

  /**
   * Obtener mensajes de un chat
   */
  async getChatMessages(jobId: string): Promise<Message[]> {
    const objectId = new Types.ObjectId(jobId);

    return await this.messageModel
      .find({ jobId: objectId })
      .sort({ createdAt: 1 })
      .lean();
  }

  /**
   * Enviar mensaje
   */
  /**
 * Enviar mensaje
 */
  async sendMessage(
    jobId: string,
    senderId: string,
    content: string,
    type: string = 'text'
  ): Promise<Message> {
    // ✅ ASEGURAR QUE EXISTE EL CHATROOM (sin duplicar)
    await this.getOrCreateChatRoom(jobId);

    const sender = await this.userModel.findById(senderId).lean();
    if (!sender) throw new Error('Usuario no encontrado');

    const message = new this.messageModel({
      jobId: new Types.ObjectId(jobId),
      senderId: new Types.ObjectId(senderId),
      senderName: sender.name,
      senderAvatar: sender.avatar,
      content,
      type,
      isRead: false
    });

    const savedMessage = await message.save();
    await this.updateChatRoomLastMessage(jobId, savedMessage, senderId);

    return savedMessage;
  }

  /**
   * Marcar mensajes como leídos
   */
  async markMessagesAsRead(jobId: string, userId: string): Promise<number> {
    const result = await this.messageModel.updateMany(
      {
        jobId: new Types.ObjectId(jobId),
        senderId: { $ne: new Types.ObjectId(userId) },
        isRead: false
      },
      { $set: { isRead: true } }
    );

    // Resetear contador de no leídos en ChatRoom
    await this.chatRoomModel.updateOne(
      { jobId: new Types.ObjectId(jobId), 'participants._id': new Types.ObjectId(userId) },
      { $set: { 'participants.$.unreadCount': 0 } }
    );

    return result.modifiedCount;
  }


  /**
 * Enviar mensaje con archivo (URL ya subida desde frontend)
 */
  async sendMessageWithFileUrl(
    jobId: string,
    senderId: string,
    content: string,
    type: string,
    fileUrl: string
  ): Promise<Message> {
    // ✅ ASEGURAR QUE EXISTE EL CHATROOM (sin duplicar)
    await this.getOrCreateChatRoom(jobId);

    const sender = await this.userModel.findById(senderId).lean();
    if (!sender) throw new Error('Usuario no encontrado');

    const message = new this.messageModel({
      jobId: new Types.ObjectId(jobId),
      senderId: new Types.ObjectId(senderId),
      senderName: sender.name,
      senderAvatar: sender.avatar,
      content: content || `Envió un archivo`,
      type,
      fileUrl,
      isRead: false
    });

    const savedMessage = await message.save();
    await this.updateChatRoomLastMessage(jobId, savedMessage, senderId);

    return savedMessage;
  }

  /**
   * Eliminar todos los mensajes de un chat
   */
  async deleteChatMessages(jobId: string, userId: string): Promise<boolean> {
    try {
      console.log(`🗑️ Eliminando mensajes de chat ${jobId} por usuario ${userId}`);

      // Verificar que existe el ChatRoom
      const chatRoom: any = await this.chatRoomModel.findOne({
        jobId: new Types.ObjectId(jobId)
      }).lean();

      if (!chatRoom) {
        throw new Error('Chat no encontrado');
      }

      // Verificar que el usuario es participante
      const isParticipant = chatRoom.participants.some(
        (p: any) => p._id.toString() === userId.toString()
      );

      if (!isParticipant) {
        throw new Error('No autorizado para eliminar mensajes de este chat');
      }

      // Eliminar todos los mensajes
      const deleteResult = await this.messageModel.deleteMany({
        jobId: new Types.ObjectId(jobId)
      });

      console.log(`🗑️ ${deleteResult.deletedCount} mensajes eliminados`);

      // Actualizar ChatRoom - resetear último mensaje y contadores
      await this.chatRoomModel.updateOne(
        { jobId: new Types.ObjectId(jobId) },
        {
          $set: {
            lastMessage: null,
            'participants.$[].unreadCount': 0
          }
        }
      );

      console.log(`✅ Chat ${jobId} limpiado correctamente`);
      return true;

    } catch (error) {
      console.error('❌ Error eliminando chat:', error);
      throw error;
    }
  }

  /**
   * Actualizar último mensaje en ChatRoom
   */
  private async updateChatRoomLastMessage(
    jobId: string,
    message: Message,
    senderId: string
  ) {
    const chatRoom = await this.chatRoomModel.findOne({
      jobId: new Types.ObjectId(jobId)
    });

    if (!chatRoom) return;

    chatRoom.lastMessage = {
      content: message.content,
      senderName: message.senderName,
      createdAt: message.createdAt,
      isRead: false
    };

    // Incrementar contador de no leídos para el receptor
    chatRoom.participants.forEach(p => {
      if (p._id.toString() !== senderId) {
        p.unreadCount += 1;
      }
    });

    chatRoom.markModified('participants');
    await chatRoom.save();
  }

  /**
 * Eliminar chat completo (ChatRoom + Mensajes)
 */
async deleteChat(jobId: string, userId: string): Promise<boolean> {
  try {
    console.log(`🗑️ Eliminando chat completo ${jobId} por usuario ${userId}`);

    // Verificar que existe el ChatRoom
    const chatRoom: any = await this.chatRoomModel.findOne({
      jobId: new Types.ObjectId(jobId)
    }).lean();

    if (!chatRoom) {
      throw new Error('Chat no encontrado');
    }

    // Verificar que el usuario es participante
    const isParticipant = chatRoom.participants.some(
      (p: any) => p._id.toString() === userId.toString()
    );

    if (!isParticipant) {
      throw new Error('No autorizado para eliminar este chat');
    }

    // 1. Eliminar todos los mensajes
    const deleteMessagesResult = await this.messageModel.deleteMany({
      jobId: new Types.ObjectId(jobId)
    });

    console.log(`🗑️ ${deleteMessagesResult.deletedCount} mensajes eliminados`);

    // 2. Eliminar el ChatRoom
    await this.chatRoomModel.deleteOne({
      jobId: new Types.ObjectId(jobId)
    });

    console.log(`✅ Chat ${jobId} eliminado completamente`);
    return true;

  } catch (error) {
    console.error('❌ Error eliminando chat:', error);
    throw error;
  }
}

async deleteSingleMessage(messageId: string, userId: string): Promise<boolean> {
  const message = await this.messageModel.findById(messageId);

  if (!message) {
    throw new Error('Mensaje no encontrado');
  }

  // 🔐 Solo el dueño del mensaje puede borrarlo
  if (message.senderId.toString() !== userId.toString()) {
    throw new Error('No autorizado para eliminar este mensaje');
  }

  await this.messageModel.deleteOne({ _id: messageId });

  return true;
}

}