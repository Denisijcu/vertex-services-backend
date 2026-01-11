import {
  Resolver,
  Query,
  Context,
  Mutation,
  Args,
  Float,
  InputType,
  Field,
  GqlExecutionContext
} from '@nestjs/graphql';
import {
  ForbiddenException,
  BadRequestException,
  UseGuards,
  createParamDecorator,
  ExecutionContext
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

//import { Resolver, Query, Context, Mutation, Args, ID, GqlExecutionContext } from '@nestjs/graphql';

// SCHEMAS Y SEGURIDAD
import { Job, JobDocument, JobStatus } from './job.schema';
import { User, UserDocument } from './user.schema';
import { GqlAuthGuard } from './auth/graphql-auth.guard';

// TIPOS CENTRALIZADOS
import { UserInfoType } from './user-info-type';
import { GeneralStatsType } from './general-stats-type';

/* ==========================================================================
   CURRENT USER DECORATOR (Corregido)
   ========================================================================== */
export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req.user;
  },
);





/* ==========================================================================
   GRAPHQL INPUT TYPES (Inputs locales para el Resolver)
   ========================================================================== */

@InputType()
class SocialLinksInput {
  @Field({ nullable: true }) linkedin?: string;
  @Field({ nullable: true }) twitter?: string;
  @Field({ nullable: true }) instagram?: string;
  @Field({ nullable: true }) github?: string;
  @Field({ nullable: true }) facebook?: string;
}

@InputType()
class UpdateProfileInput {
  @Field({ nullable: true }) name?: string;
  @Field({ nullable: true }) bio?: string;
  @Field({ nullable: true }) phone?: string;
  @Field({ nullable: true }) location?: string;
  @Field({ nullable: true }) avatar?: string;
  @Field(() => SocialLinksInput, { nullable: true }) socialLinks?: SocialLinksInput;
}

@InputType()
class CreateJobInput {
  @Field() title: string;
  @Field() description: string;
  @Field(() => Float) price: number;
  @Field() location: string;
  @Field() category: string;
}

/* ==========================================================================
   MAIN RESOLVER (Sincronizado con UserInfoType)
   ========================================================================== */

@Resolver(() => UserInfoType)
export class AppResolver {
  constructor(
    @InjectModel(Job.name) private jobModel: Model<JobDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>
  ) {}

  /* ===== ADMIN INFO ===== */

  @Query(() => [UserInfoType])
  @UseGuards(GqlAuthGuard)
  async findAll(@CurrentUser() admin: any) {
    if (admin.role !== 'ADMIN') throw new ForbiddenException('No tienes permisos de administrador');
    return await this.userModel.find().select('-password');
  }

  @Query(() => GeneralStatsType)
  @UseGuards(GqlAuthGuard)
  async getGeneralStats(@CurrentUser() admin: any) {
    if (admin.role !== 'ADMIN') throw new ForbiddenException();

    const totalUsers = await this.userModel.countDocuments();
    const totalProviders = await this.userModel.countDocuments({ role: { $in: ['PROVIDER', 'BOTH'] } });
    const totalClients = await this.userModel.countDocuments({ role: 'CLIENT' });
    const activeUsers = await this.userModel.countDocuments({ isActive: true });

    const usersWithStats = await this.userModel.find({ 'stats.totalEarned': { $exists: true } });
    const totalEarnings = usersWithStats.reduce((a, u) => a + (u.stats?.totalEarned ?? 0), 0);

    return { totalUsers, totalProviders, totalClients, activeUsers, totalEarnings };
  }

  /* ===== PROFILE ===== */

  @Query(() => UserInfoType)
  @UseGuards(GqlAuthGuard)
  async me(@CurrentUser() user: any) {
    return this.userModel.findById(user._id).select('-password');
  }

  @Mutation(() => UserInfoType)
  @UseGuards(GqlAuthGuard)
  async updateProfile(@CurrentUser() user: any, @Args('input') input: UpdateProfileInput) {
    return this.userModel.findByIdAndUpdate(
      user._id, 
      { $set: input }, 
      { new: true }
    ).select('-password');
  }

  /* ===== JOBS ===== */

  @Mutation(() => UserInfoType)
  @UseGuards(GqlAuthGuard)
  async createJob(@Args('input') input: CreateJobInput, @CurrentUser() user: any) {
    if (input.price <= 0) throw new BadRequestException('El precio debe ser mayor a 0');
    
    const job = new this.jobModel({
      ...input,
      client: { _id: user._id, name: user.name, email: user.email },
      status: JobStatus.OPEN
    });
    
    await job.save();
    return this.userModel.findById(user._id);
  }
}
