import { UseGuards } from '@nestjs/common';
import { Args, Field, InputType, Mutation, ObjectType, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../app.resolver';
import { AuthService } from './auth.service';
import { GqlAuthGuard } from './graphql-auth.guard';

// ============================================
// TIPOS GRAPHQL - SUBTIPOS
// ============================================

@ObjectType()
class ServiceOffered {
  @Field()
  category: string;

  @Field()
  title: string;

  @Field()
  description: string;

  @Field()
  pricePerHour: number;

  @Field()
  isActive: boolean;
}

@ObjectType()
class SocialLinks {
  @Field({ nullable: true })
  linkedin?: string;

  @Field({ nullable: true })
  twitter?: string;

  @Field({ nullable: true })
  instagram?: string;

  @Field({ nullable: true })
  github?: string;

  @Field({ nullable: true })
  facebook?: string;
}

@ObjectType()
class Stats {
  @Field()
  jobsCompleted: number;

  @Field()
  jobsReceived: number;

  @Field()
  totalEarned: number;

  @Field()
  totalSpent: number;

  @Field()
  averageRating: number;

  @Field()
  totalReviews: number;
}

@ObjectType()
class TwoFactorAuth {
  @Field()
  enabled: boolean;
}

// ============================================
// USER INFO
// ============================================

@ObjectType()
class UserInfo {
  @Field()
  _id: string;

  @Field()
  name: string;

  @Field()
  email: string;

  @Field()
  role: string;

  @Field({ nullable: true })
  avatar?: string;

  @Field()
  emailVerified: boolean;

  @Field({ nullable: true })
  bio?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  location?: string;

  @Field(() => [ServiceOffered], { nullable: true })
  servicesOffered?: ServiceOffered[];

  @Field(() => SocialLinks, { nullable: true })
  socialLinks?: SocialLinks;

  @Field(() => Stats, { nullable: true })
  stats?: Stats;

  @Field(() => TwoFactorAuth, { nullable: true })
  twoFactorAuth?: TwoFactorAuth;

  @Field()
  isActive: boolean;

  @Field({ nullable: true })
  lastLogin?: string;

  @Field(() => [String], { nullable: true })
  gallery?: string[];

}

// ============================================
// RESPUESTAS
// ============================================



@ObjectType()
class LoginResponse {
  @Field({ nullable: true })
  access_token?: string;

  @Field({ nullable: true })
  requiresTwoFactor?: boolean;

  @Field({ nullable: true })
  message?: string;

  @Field(() => UserInfo, { nullable: true })
  user?: UserInfo;
}

@ObjectType()
class MessageResponse {
  @Field()
  message: string;

  @Field({ nullable: true })
  emailVerificationToken?: string;
}

@ObjectType()
class TwoFactorSetupResponse {
  @Field()
  qrCode: string;

  @Field()
  secret: string;

  @Field(() => [String])
  backupCodes: string[];
}

// ============================================
// INPUTS
// ============================================

@InputType()
class RegisterInput {
  @Field()
  email: string;

  @Field()
  password: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  role?: string;

  @Field({ nullable: true, defaultValue: false })
  termsAccepted?: boolean;
}

@InputType()
class LoginInput {
  @Field()
  email: string;

  @Field()
  password: string;

  @Field({ nullable: true })
  twoFactorCode?: string;
}

@InputType()
class VerifyEmailInput {
  @Field()
  token: string;
}

@InputType()
class TwoFactorCodeInput {
  @Field()
  code: string;
}

@InputType()
class ForgotPasswordInput {
  @Field()
  email: string;
}


// ============================================
// RESOLVER
// ============================================

@Resolver()
export class AuthResolver {
  constructor(private authService: AuthService) { }

  // ============================================
  // REGISTRO
  // ============================================
   @Mutation(() => MessageResponse)
  async register(@Args('input') input: RegisterInput) {
    try {
      console.log('📝 Register input received:', input);
      const result = await this.authService.register(
        input.email,
        input.password,
        input.name,
        input.role,
        input.termsAccepted
      );
      return result;
    } catch (error: any) {
      console.error('❌ Register error:', error?.message);
      return {
        message: error?.message || 'Registration failed',
        emailVerificationToken: null
      };
    }
  }

  // ============================================
  // LOGIN
  // ============================================
   @Mutation(() => LoginResponse)
  async login(@Args('input') input: LoginInput) {
    try {
      console.log('🔐 Login attempt:', input.email);
      const result = await this.authService.login(
        input.email,
        input.password,
        input.twoFactorCode
      );
      return result;
    } catch (error: any) {
      console.error('❌ Login error:', error?.message);
      return {
        access_token: null,
        requiresTwoFactor: false,
        message: error?.message || 'Login failed',
        user: null
      };
    }
  }

  // ============================================
  // VERIFICAR EMAIL
  // ============================================
  @Mutation(() => MessageResponse)
  async verifyEmail(@Args('input') input: VerifyEmailInput) {
    return this.authService.verifyEmail(input.token);
  }

  // ============================================
  // RECUPERAR CONTRASEÑA
  // ============================================
  @Mutation(() => MessageResponse)
  async forgotPassword(@Args('input') input: ForgotPasswordInput) {
    return this.authService.forgotPassword(input.email);
  }

  // ============================================
  // HABILITAR 2FA (REQUIERE AUTH)
  // ============================================
  @Mutation(() => TwoFactorSetupResponse)
  @UseGuards(GqlAuthGuard)
  async enable2FA(@CurrentUser() user: any) {
    return this.authService.enable2FA(user._id);
  }

  // ============================================
  // CONFIRMAR 2FA
  // ============================================
  @Mutation(() => MessageResponse)
  @UseGuards(GqlAuthGuard)
  async confirm2FA(
    @CurrentUser() user: any,
    @Args('input') input: TwoFactorCodeInput
  ) {
    return this.authService.confirm2FA(user._id, input.code);
  }

  // ============================================
  // DESHABILITAR 2FA
  // ============================================
  @Mutation(() => MessageResponse)
  @UseGuards(GqlAuthGuard)
  async disable2FA(
    @CurrentUser() user: any,
    @Args('input') input: TwoFactorCodeInput
  ) {
    return this.authService.disable2FA(user._id, input.code);
  }

  // ============================================
  // OBTENER PERFIL (REQUIERE AUTH)
  // ============================================
  @Query(() => UserInfo)
  @UseGuards(GqlAuthGuard)
  async me(@CurrentUser() user: any) {
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      emailVerified: user.emailVerified,
      bio: user.bio,
      phone: user.phone,
      location: user.location,
      servicesOffered: user.servicesOffered,
      socialLinks: user.socialLinks,
      stats: user.stats,
      twoFactorAuth: user.twoFactorAuth,
      isActive: user.isActive,
      lastLogin: user.lastLogin?.toISOString(),
      gallery: user.gallery || [],
    };
  }
}