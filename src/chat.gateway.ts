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
    const roomName = `chat_${data.jobId}`;
    client.join(roomName);

    // Obtener info de la sala
    const room = this.server.sockets.adapter.rooms.get(roomName);
    const clientCount = room ? room.size : 0;

    console.log(`📥 Cliente ${client.id} unido a ${roomName}`);
    console.log(`👥 Total de clientes en sala: ${clientCount}`);

    // Confirmar al cliente que se unió
    client.emit('joined_chat', {
      jobId: data.jobId,
      roomName,
      clientCount
    });
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
  /**
   * Emitir nuevo mensaje a los participantes del chat
   */
  /**
   * Emitir nuevo mensaje a los participantes del chat
   */
  emitNewMessage(jobId: string, message: any) {
    try {
      // Convertir a JSON plano
      const plainMessage = JSON.parse(JSON.stringify(message));

      const roomName = `chat_${jobId}`;

      // Obtener cuántos clientes están en la sala
      const room = this.server.sockets.adapter.rooms.get(roomName);
      const clientCount = room ? room.size : 0;

      console.log(`🚀 Emitiendo mensaje a sala ${roomName}`);
      console.log(`👥 Clientes en la sala: ${clientCount}`);
      console.log(`📦 Mensaje:`, {
        _id: plainMessage._id,
        content: plainMessage.content?.substring(0, 50),
        senderId: plainMessage.senderId
      });

      // Emitir a toda la sala
      this.server.to(roomName).emit('new_message', plainMessage);

      console.log(`✅ Mensaje emitido exitosamente`);

    } catch (error) {
      console.error('❌ Error emitiendo mensaje:', error);
    }
  }


  @SubscribeMessage('test_connection')
  handleTestConnection(@ConnectedSocket() client: Socket) {
    console.log('🧪 Test connection from:', client.id);
    client.emit('test_response', {
      status: 'connected',
      socketId: client.id,
      timestamp: new Date()
    });
    return { status: 'ok' };
  }
}