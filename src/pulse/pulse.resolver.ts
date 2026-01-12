// UBICACIÓN: backend/src/pulse/pulse.resolver.ts
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { PulseService } from './pulse.service';
import { PulsePost } from './pulse.schema';
import { NotFoundException } from '@nestjs/common';

@Resolver(() => PulsePost)
export class PulseResolver {
  constructor(private readonly pulseService: PulseService) { }

  @Query(() => [PulsePost], { name: 'getPulsePosts' })
  async getPosts(@Args('categoryId', { nullable: true }) categoryId: string) {
    // 🛡️ Traemos los posts y forzamos los virtuals para que el pulseId llegue al frontend
    const posts = await this.pulseService.findAll(categoryId);
    return posts.map(post => post.toObject({ virtuals: true }));
  }

  @Mutation(() => PulsePost)
  async createPulsePost(
    @Args('content') content: string,
    @Args('authorId') authorId: string,
    @Args('imageUrl', { nullable: true }) imageUrl: string,
    @Args('category', { nullable: true }) category: string,
    @Args('authorName', { nullable: true }) authorName: string,
    @Args('avatar', { nullable: true }) avatar: string,
    @Args('mediaUrl', { nullable: true }) mediaUrl: string,
    @Args('mediaType', { nullable: true }) mediaType: string,
  ) {
    // Creamos el post y devolvemos el objeto con virtuals
    const post = await this.pulseService.create(authorId, content, imageUrl, category, authorName, avatar, mediaUrl, mediaType);
    return post.toObject({ virtuals: true });
  }

  // --- INTERACCIÓN SOCIAL ---

  @Mutation(() => PulsePost)
  async toggleLike(
    @Args('pulseId') pulseId: string,
    @Args('userId') userId: string
  ) {
    // Lógica de dar/quitar like
    const post = await this.pulseService.toggleLike(pulseId, userId);
    return post.toObject({ virtuals: true });
  }

  @Mutation(() => PulsePost)
  async addComment(
    @Args('pulseId') pulseId: string,
    @Args('content') content: string,
    @Args('authorId') authorId: string,
    @Args('authorName') authorName: string,
    @Args('avatar', { nullable: true }) avatar: string,
  ) {
    // Añadimos el comentario con la fecha del servidor para evitar discrepancias
    const post = await this.pulseService.addComment(pulseId, {
      authorId,
      authorName,
      content,
      avatar,
      createdAt: new Date()
    });
    if (!post) throw new NotFoundException('Post no encontrado');
    return post.toObject({ virtuals: true });
  }

  @Mutation(() => Boolean)
  async deletePulsePost(@Args('pulseId') pulseId: string) {
    return this.pulseService.delete(pulseId);
  }
}