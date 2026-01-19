import { Resolver, Mutation, Args, Query, ObjectType, Field } from '@nestjs/graphql';
import { UserService } from './auth/user.service';
import { UserInfoType, GeneralStatsType } from './user-info-type';
import { UserRole, UserDocument } from './user.schema';
import { AdminService } from './admin.service';
import { Job } from './job.schema'; // 👈 IMPORT CORRECTO

// ============================================
// RESPONSE TYPES
// ============================================
@ObjectType()
class SystemAlertResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;
}

@ObjectType()
class AdminActionResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;
}

@Resolver()
export class AdminResolver {
  constructor(
    private readonly userService: UserService, 
    private readonly adminService: AdminService
  ) {}

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
  // QUERIES
  // ============================================

  @Query(() => [UserInfoType])
  async findAllUsers(): Promise<UserInfoType[]> {
    const users = await this.adminService.findAllUsers();
    return users.map(u => this.mapToUserInfo(u));
  }

  @Query(() => GeneralStatsType)
  async getGeneralStats(): Promise<GeneralStatsType> {
    return this.adminService.getGeneralStats();
  }

  @Query(() => [Job]) // 👈 CORRECTO
  async getAllJobs(): Promise<Job[]> {
    return this.adminService.getAllJobs();
  }

  @Query(() => [String])
  async getDisputes(): Promise<any[]> {
    return this.adminService.getDisputes();
  }

  @Query(() => [String])
  async getSystemLogs(@Args('limit', { nullable: true }) limit?: number): Promise<any[]> {
    return this.adminService.getSystemLogs(limit || 50);
  }

  // ============================================
  // MUTATIONS - USER MANAGEMENT
  // ============================================

  @Mutation(() => UserInfoType)
  async toggleUserStatus(
    @Args('userId') userId: string,
    @Args('isActive') isActive: boolean
  ): Promise<UserInfoType> {
    const userDoc = await this.userService.toggleUserStatus(userId, isActive);
    return this.mapToUserInfo(userDoc);
  }

  @Mutation(() => UserInfoType)
  async changeUserRole(
    @Args('userId') userId: string,
    @Args('newRole') newRole: UserRole
  ): Promise<UserInfoType> {
    const userDoc = await this.userService.changeUserRole(userId, newRole);
    return this.mapToUserInfo(userDoc);
  }

  @Mutation(() => AdminActionResponse)
  async suspendUser(
    @Args('userId') userId: string,
    @Args('reason') reason: string
  ): Promise<AdminActionResponse> {
    return this.adminService.suspendUser(userId, reason);
  }

  @Mutation(() => AdminActionResponse)
  async restoreUser(@Args('userId') userId: string): Promise<AdminActionResponse> {
    return this.adminService.restoreUser(userId);
  }

  @Mutation(() => AdminActionResponse)
  async banUser(
    @Args('userId') userId: string,
    @Args('reason') reason: string
  ): Promise<AdminActionResponse> {
    return this.adminService.banUser(userId, reason);
  }

  // ============================================
  // 📢 MUTATION - SYSTEM ALERTS
  // ============================================

  @Mutation(() => SystemAlertResponse)
  async createSystemAlert(
    @Args('title') title: string,
    @Args('message') message: string,
    @Args('severity') severity: string
  ): Promise<SystemAlertResponse> {
    console.log('📢 Admin creando alerta del sistema:', { title, message, severity });
    return this.adminService.createSystemAlert(title, message, severity);
  }
}