import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { UserService } from './auth/user.service';
import { UserInfoType } from './user-info-type';
import { GeneralStatsType } from './general-stats-type';
import { UserRole, UserDocument } from './user.schema';

@Resolver()
export class AdminResolver {
  constructor(private readonly userService: UserService) {}

  // ============================================
  // Helper para mapear UserDocument -> UserInfoType
  // ============================================
  private mapToUserInfo(userDoc: UserDocument): UserInfoType {
    return {
      _id: userDoc._id.toString(),
      name: userDoc.name,
      email: userDoc.email,
      role: userDoc.role,
      isActive: userDoc.isActive,
      avatar: userDoc.avatar,
      bio: userDoc.bio,
      phone: userDoc.phone,
      location: userDoc.location,
      jobsCompleted: userDoc.stats?.jobsCompleted || 0,
      totalEarned: userDoc.stats?.totalEarned || 0,
    };
  }

  // ============================================
  // Activar / Desactivar usuario
  // ============================================
  @Mutation(() => UserInfoType)
  async toggleUserStatus(
    @Args('userId') userId: string,
    @Args('isActive') isActive: boolean
  ): Promise<UserInfoType> {
    const userDoc = await this.userService.toggleUserStatus(userId, isActive);
    return this.mapToUserInfo(userDoc);
  }

  // ============================================
  // Cambiar rol de usuario
  // ============================================
  @Mutation(() => UserInfoType)
  async changeUserRole(
    @Args('userId') userId: string,
    @Args('newRole') newRole: UserRole
  ): Promise<UserInfoType> {
    const userDoc = await this.userService.changeUserRole(userId, newRole);
    return this.mapToUserInfo(userDoc);
  }

  // ============================================
  // Obtener todos los usuarios
  // ============================================
  @Query(() => [UserInfoType])
  async findAllUsers(): Promise<UserInfoType[]> {
    const { users } = await this.userService.findAll();
    return users.map(u => this.mapToUserInfo(u));
  }

  // ============================================
  // Estadísticas generales
  // ============================================
  @Query(() => GeneralStatsType)
  async getGeneralStats(): Promise<GeneralStatsType> {
    return this.userService.getGeneralStats();
  }
}
