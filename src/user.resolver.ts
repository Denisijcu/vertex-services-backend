import { BadRequestException, UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql'; // 👈 Agrega ID aquí
import { GqlAuthGuard } from './auth/graphql-auth.guard';
import { UserService } from './auth/user.service';
import { CurrentUser } from './app.resolver';
import { UpdateProfessionalProfileInput } from './user-profile.input';
import { User } from './user.schema';

@Resolver(() => User)
export class UserResolver {
  constructor(private readonly userService: UserService) { }

  @Query(() => User, { name: 'me' })
  @UseGuards(GqlAuthGuard)
  async getMe(@CurrentUser() user: any) {
    return this.userService.findOneById(user._id);
  }

  // 👇 NUEVA QUERY - Para ver perfil de otros usuarios
  // ✅ QUERY ACTUALIZADA: Inteligente y flexible
  @Query(() => User, { name: 'getUserProfile', nullable: true })
  @UseGuards(GqlAuthGuard) // 👈 Agregamos el guard para proteger la ruta
  async getUserProfile(
    @Args('userId', { type: () => ID, nullable: true }) userId?: string,
    @CurrentUser() user?: any, // 👈 Capturamos al usuario logueado
  ) {
    // Si mandas un ID (Marketplace), buscamos ese. 
    // Si no mandas nada (Mi Perfil), buscamos el tuyo.
    const targetId = userId || user?._id;

    if (!targetId) {
      // Solo lanzamos error si realmente no hay rastro de ningún ID
      throw new Error('No se pudo determinar el ID del perfil a cargar');
    }

    const foundUser = await this.userService.findOneById(targetId);

    if (!foundUser) {
      throw new Error('El usuario solicitado ya no existe en Vertex');
    }

    return foundUser;
  }

  @Query(() => [User], { name: 'getProviders' })
  async getProviders(
    @Args('categoryId', { nullable: true }) categoryId?: string,
    @Args('search', { nullable: true }) search?: string,
  ) {
    return this.userService.findProviders({ categoryId, search });
  }

@Mutation(() => User)
  @UseGuards(GqlAuthGuard)
  async updateProfessionalProfile(
    @CurrentUser() user: any,
    @Args('input') input: UpdateProfessionalProfileInput
  ) {
    // 1. Ejecutamos la actualización
    const updated = await this.userService.updateProfessionalProfile(user._id, input);
    
    // 2. 🛡️ PROTECCIÓN: Si el servicio devuelve el objeto viejo o incompleto, 
    // forzamos una búsqueda fresca para que el Frontend reciba TODO (stats, gallery, etc.)
    if (!updated) {
      throw new BadRequestException('No se pudo actualizar el perfil profesional.');
    }

    // Buscamos el usuario final para asegurar que servicesOffered y stats lleguen bien
    return this.userService.findOneById(user._id);
  }

  @Mutation(() => User)
  @UseGuards(GqlAuthGuard)
  async updateGallery(
    @CurrentUser() user: any,
    @Args('urls', { type: () => [String] }) urls: string[]
  ) {
    if (urls.length > 3) {
      throw new BadRequestException('Máximo 3 imágenes permitidas en Vertex Vault');
    }
    return this.userService.updateProfile(user._id, { gallery: urls });
  }

  @Mutation(() => String) // 👈 Mutación rápida para limpiar
  async vertexCleanStats() {
    const result = await this.userService.fixNegativeStats();
    return `${result.message}. Usuarios corregidos: ${result.modifiedCount}`;
  }

  @Mutation(() => User)
  @UseGuards(GqlAuthGuard)
  async changePassword(
    @CurrentUser() user: any,
    @Args('oldPassword') oldPassword: string,
    @Args('newPassword') newPassword: string
  ) {
    return this.userService.changePassword(user._id, oldPassword, newPassword);
  }

  @Mutation(() => User)
  @UseGuards(GqlAuthGuard)
  async enableBiometric(
    @CurrentUser() user: any,
    @Args('publicKey') publicKey: string
  ) {
    return this.userService.enableBiometric(user._id, publicKey);
  }

  @Mutation(() => User)
  @UseGuards(GqlAuthGuard)
  async disableBiometric(@CurrentUser() user: any) {
    return this.userService.disableBiometric(user._id);
  }
}