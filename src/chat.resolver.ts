
import { Resolver, Query, Mutation, Args, Context, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { GqlAuthGuard } from './auth/graphql-auth.guard';
import { ChatRoom } from './chat-room.schema';
import { Message } from './message.schema';
import { InputType, Field } from '@nestjs/graphql';
import { ChatGateway } from './chat.gateway';


//import { FileUpload, GraphQLUpload } from 'graphql-upload';

@InputType()
class SendMessageInput {
  @Field() jobId: string;
  @Field() content: string;
  @Field({ defaultValue: 'text' }) type: string;
}

@InputType()
class SendFileMessageInput {
  @Field(() => ID) jobId: string; // 👈 SOLUCIÓN: Especificar que es ID
  @Field({ nullable: true }) content: string;
  @Field() type: string;
  @Field() fileUrl: string;
}

@Resolver()
export class ChatResolver {
  constructor(
    private chatService: ChatService,
    private chatGateway: ChatGateway
  ) { }

  @Query(() => [ChatRoom])
  @UseGuards(GqlAuthGuard)
  async getMyChats(@Context() context: any): Promise<ChatRoom[]> {
    const userId = context.req.user._id;
    return this.chatService.getMyChats(userId);
  }

  @Query(() => [Message])
  @UseGuards(GqlAuthGuard)
  async getChatMessages(
    @Args('jobId', { type: () => ID }) jobId: string, // 👈 AGREGAR { type: () => ID }

  ): Promise<Message[]> {
    return this.chatService.getChatMessages(jobId);
  }

  @Mutation(() => Message)
  @UseGuards(GqlAuthGuard)
  async sendMessage(
    @Args('input') input: SendMessageInput,
    @Context() context: any
  ): Promise<Message> {
    const userId = context.req.user._id;

    const message = await this.chatService.sendMessage(
      input.jobId,
      userId,
      input.content,
      input.type
    );

    // Emitir mensaje por WebSocket
    this.chatGateway.emitNewMessage(input.jobId, message);

    return message;
  }

  @Mutation(() => Message)
  @UseGuards(GqlAuthGuard)
  async sendFileMessage(
    @Args('input') input: SendFileMessageInput,
    @Context() context: any
  ): Promise<Message> {
    const userId = context.req.user._id;

    // Llamar al servicio
    const message = await this.chatService.sendMessageWithFileUrl(
      input.jobId,
      userId,
      input.content || '',
      input.type,
      input.fileUrl
    );

    // Emitir por WebSocket
    this.chatGateway.emitNewMessage(input.jobId, message);

    return message;
  }
  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async markMessagesAsRead(
    @Args('jobId', { type: () => ID }) jobId: string, // 👈 AGREGAR { type: () => ID }
    @Context() context: any
  ): Promise<boolean> {
    const userId = context.req.user._id;
    await this.chatService.markMessagesAsRead(jobId, userId);
    return true;
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async deleteChatMessages(
    @Args('jobId', { type: () => ID }) jobId: string,
    @Context() context: any
  ): Promise<boolean> {
    const userId = context.req.user._id;
    return this.chatService.deleteChatMessages(jobId, userId);
  }
 

  @Mutation(() => Boolean)
@UseGuards(GqlAuthGuard)
async deleteMessage(
  @Args('messageId', { type: () => ID }) messageId: string,
  @Context() context: any
): Promise<boolean> {
  const userId = context.req.user._id;
  return this.chatService.deleteSingleMessage(messageId, userId);
}

@Mutation(() => Boolean)
@UseGuards(GqlAuthGuard)
async deleteChat(
  @Args('jobId', { type: () => ID }) jobId: string,
  @Context() context: any
): Promise<boolean> {
  const userId = context.req.user._id;
  return this.chatService.deleteChat(jobId, userId);
}

}