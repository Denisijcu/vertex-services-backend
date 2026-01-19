
// backend/src/pulse/pulse.gateway.ts
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: true })
export class PulseGateway {
  @WebSocketServer()
  server: Server;

  notifyNewPost(post: any) {
    this.server.emit('newPulsePost', post);
  }

  notifyNewLike(pulseId: string, userId: string) {
    this.server.emit('newLike', { pulseId, userId });
  }

  notifyNewComment(pulseId: string, comment: any) {
    this.server.emit('newComment', { pulseId, comment });
  }
}