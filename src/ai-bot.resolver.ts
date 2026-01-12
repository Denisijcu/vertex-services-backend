import { UseGuards } from '@nestjs/common';
import { Args, Field, InputType, Mutation, ObjectType, Query, Resolver } from '@nestjs/graphql';
import { AIBotService } from './auth/ai-bot.service';
import { GqlAuthGuard } from './auth/graphql-auth.guard';
import { CurrentUser } from './app.resolver';

// ============================================
// TIPOS GRAPHQL
// ============================================


@ObjectType()
class BotResponse {
  @Field()
  message: string;

  @Field(() => [String], { nullable: true })
  functionCalled?: string[];

  @Field({ nullable: true })
  functionResult?: string;

  @Field()
  timestamp: string;
}

@ObjectType()
class SuggestionsResponse {
  @Field(() => [String])
  suggestions: string[];
}

// ============================================
// INPUTS
// ============================================

@InputType()
class ChatInput {
  @Field()
  message: string;

  @Field(() => [ConversationMessageInput], { nullable: true })
  history?: ConversationMessageInput[];
}

@InputType()
class ConversationMessageInput {
  @Field()
  role: string;

  @Field()
  content: string;
}

// ============================================
// RESOLVER
// ============================================

@Resolver()
export class AIBotResolver {
  constructor(private readonly aiBotService: AIBotService) { }

  // ============================================
  // CHAT CON EL BOT
  // ============================================
  @Mutation(() => BotResponse)
  @UseGuards(GqlAuthGuard)
  async chatWithBot(
    @Args('input') input: ChatInput,
    @CurrentUser() user: any
  ) {
    const result = await this.aiBotService.chat(
      user._id,
      input.message,
      input.history || []
    );

    return {
      message: result.message,
      functionCalled: result.functionCalled,
      functionResult: result.functionResult ? JSON.stringify(result.functionResult) : null,
      timestamp: new Date().toISOString()
    };
  }

  // ============================================
  // OBTENER SUGERENCIAS
  // ============================================
  @Query(() => SuggestionsResponse)
  @UseGuards(GqlAuthGuard)
  async getBotSuggestions(@CurrentUser() user: any) {
    const suggestions = await this.aiBotService.generateSuggestions(user._id);
    return { suggestions };
  }
}