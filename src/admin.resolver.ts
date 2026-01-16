import { Resolver, Mutation, Args, Query, ObjectType, Field } from '@nestjs/graphql';
import { UserService } from './auth/user.service';
import { UserInfoType, GeneralStatsType } from './user-info-type';
import { UserRole, UserDocument } from './user.schema';
import { AdminService } from './admin.service';


@ObjectType()
class SystemAlertResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;
}

@Resolver()
export class AdminResolver {
  constructor(private readonly userService: UserService, private readonly adminService: AdminService) {}

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
    stripeAccountComplete: (userDoc as any).stripeAccountComplete || false,
    stats: {
      jobsCompleted: userDoc.stats?.jobsCompleted || 0,
      totalEarned: userDoc.stats?.totalEarned || 0,
      averageRating: userDoc.stats?.averageRating || 0,
      totalReviews: userDoc.stats?.totalReviews || 0,
    },
    createdAt: (userDoc as any).createdAt?.toString() || new Date().toISOString(),
    lastLogin: (userDoc as any).lastLogin?.toString() || null,
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
@Query(() => GeneralStatsType)  // ✅ CORRECTO
async getGeneralStats(): Promise<GeneralStatsType> {
  return this.adminService.getGeneralStats();
}
// ============================================
// 📢 CREAR ALERTA DEL SISTEMA
// ============================================
@Mutation(() => SystemAlertResponse)
async createSystemAlert(
  @Args('title') title: string,
  @Args('message') message: string,
  @Args('severity') severity: string
): Promise<SystemAlertResponse> {
  console.log('📢 Creando alerta del sistema:', { title, message, severity });
  return this.adminService.createSystemAlert(title, message, severity);
}
}
