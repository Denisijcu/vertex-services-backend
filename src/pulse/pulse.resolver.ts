// backend/src/pulse/pulse.resolver.ts
import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { PulseService } from './pulse.service';
import { PulsePost } from './pulse.schema';
import { NotFoundException } from '@nestjs/common';

@Resolver(() => PulsePost)
export class PulseResolver {
  constructor(private readonly pulseService: PulseService) {}

  @Query(() => [PulsePost], { name: 'getPulsePosts' })
  async getPosts(
    @Args('categoryId', { nullable: true }) categoryId?: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('skip', { type: () => Int, nullable: true }) skip?: number
  ) {
    const posts = await this.pulseService.findAll(
      categoryId, 
      limit || 10, 
      skip || 0
    );
    
    // 🔧 MAPEO CORRECTO
    return posts.map((post: any) => {
      const plain = typeof post.toObject === 'function' ? post.toObject() : post;
      return {
        ...plain,
        pulseId: String(plain._id),
        _id: undefined // Remover _id del objeto
      };
    });
  }

  @Mutation(() => PulsePost)
  async createPulsePost(
    @Args('content') content: string,
    @Args('authorId') authorId: string,
    @Args('authorName', { nullable: true }) authorName?: string,
    @Args('avatar', { nullable: true }) avatar?: string,
    @Args('mediaUrl', { nullable: true }) mediaUrl?: string,
    @Args('mediaType', { nullable: true }) mediaType?: string
  ) {
    const post = await this.pulseService.create(
      authorId,
      content,
      undefined,
      'GENERAL',
      authorName,
      avatar,
      mediaUrl,
      mediaType
    );
    
    const plain = post.toObject();
    return {
      ...plain,
      pulseId: String(plain._id),
      _id: undefined
    };
  }

  @Mutation(() => PulsePost)
  async toggleLike(
    @Args('pulseId') pulseId: string,
    @Args('userId') userId: string
  ) {
    const post = await this.pulseService.toggleLike(pulseId, userId);
    const plain = post.toObject();
    return {
      ...plain,
      pulseId: String(plain._id),
      _id: undefined
    };
  }

  @Mutation(() => PulsePost)
  async addComment(
    @Args('pulseId') pulseId: string,
    @Args('content') content: string,
    @Args('authorId') authorId: string,
    @Args('authorName') authorName: string,
    @Args('avatar', { nullable: true }) avatar?: string
  ) {
    const post = await this.pulseService.addComment(pulseId, {
      authorId,
      authorName,
      content,
      avatar,
      createdAt: new Date()
    });
    
    if (!post) throw new NotFoundException('Post no encontrado');
    
    const plain = post.toObject();
    return {
      ...plain,
      pulseId: String(plain._id),
      _id: undefined
    };
  }

  @Mutation(() => Boolean)
  async deletePulsePost(@Args('pulseId') pulseId: string) {
    return this.pulseService.delete(pulseId);
  }
}