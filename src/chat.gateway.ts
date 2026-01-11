import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:4200',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSockets = new Map<string, string>(); // userId -> socketId

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;

    if (userId) {
      this.userSockets.set(userId, client.id);
      console.log(`✅ Usuario ${userId} conectado: ${client.id}`);

      // Notificar a otros que este usuario está online
      this.server.emit('user_status', {
        userId,
        isOnline: true
      });
    }
  }

  handleDisconnect(client: Socket) {
    const userId = Array.from(this.userSockets.entries())
      .find(([, socketId]) => socketId === client.id)?.[0];

    if (userId) {
      this.userSockets.delete(userId);
      console.log(`❌ Usuario ${userId} desconectado`);

      this.server.emit('user_status', {
        userId,
        isOnline: false,
        lastSeen: new Date()
      });
    }
  }

  @SubscribeMessage('join_chat')
  handleJoinChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { jobId: string }
  ) {
    client.join(`chat_${data.jobId}`);
    console.log(`📥 Cliente ${client.id} unido al chat ${data.jobId}`);
  }

  @SubscribeMessage('leave_chat')
  handleLeaveChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { jobId: string }
  ) {
    client.leave(`chat_${data.jobId}`);
    console.log(`📤 Cliente ${client.id} salió del chat ${data.jobId}`);
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { jobId: string; isTyping: boolean; userId: string; userName: string }
  ) {
    client.to(`chat_${data.jobId}`).emit('typing_status', {
      userId: data.userId,
      userName: data.userName,
      jobId: data.jobId,
      isTyping: data.isTyping
    });
  }

  /**
   * Emitir nuevo mensaje a los participantes del chat
   */
  emitNewMessage(jobId: string, message: any) {
    // Convertimos a JSON plano para evitar problemas de circularidad o formatos de Mongoose
    const plainMessage = JSON.parse(JSON.stringify(message));
    this.server.to(`chat_${jobId}`).emit('new_message', plainMessage);
    console.log(`🚀 Mensaje emitido a sala chat_${jobId}`);
  }
}