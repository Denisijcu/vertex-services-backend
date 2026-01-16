import { UseGuards, BadRequestException } from '@nestjs/common';
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

  // 🔐 NUEVO: Para Post-Quantum
  @Field({ nullable: true, defaultValue: false })
  useQuantumSafe?: boolean;
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

@ObjectType()
class BiometricChallengeResponse {
  @Field()
  challenge: string;

  @Field(() => [BiometricCredentialDescriptor])
  allowCredentials: BiometricCredentialDescriptor[];
}

@ObjectType()
class BiometricCredentialDescriptor {
  @Field()
  id: string;

  @Field()
  type: string;
}

// 🔐 NUEVO: Inputs para Post-Quantum
@InputType()
class ChangePasswordInput {
  @Field()
  currentPassword: string;

  @Field()
  newPassword: string;

  @Field({ nullable: true, defaultValue: false })
  useQuantumSafe?: boolean;
}

// 🔐 NUEVO: Response para migración
@ObjectType()
class QuantumMigrationResponse {
  @Field()
  message: string;

  @Field({ nullable: true })
  alreadyQuantumSafe?: boolean;

  @Field({ nullable: true })
  quantumSafe?: boolean;

  @Field({ nullable: true })
  migratedAt?: string;
}

// 🔐 NUEVO: Response para info de seguridad
@ObjectType()
class SecurityInfoResponse {
  @Field()
  email: string;

  @Field()
  quantumSafeEnabled: boolean;

  @Field()
  cryptoAlgorithm: string;

  @Field({ nullable: true })
  passwordChangedAt?: string;

  @Field({ nullable: true })
  lastLogin?: string;

  @Field()
  lastLoginQuantumSafe: boolean;

  @Field()
  twoFactorEnabled: boolean;

  @Field()
  biometricEnabled: boolean;
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
        input.termsAccepted,
        input.useQuantumSafe // 🔐 NUEVO: Pasar parámetro quantum
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

  // ============================================
  // BIOMETRÍA: GENERAR DESAFÍO
  // ============================================
  @Mutation(() => BiometricChallengeResponse)
  async getBiometricChallenge(@Args('email') email: string) {
    try {
      console.log('🧬 Generando desafío biométrico para:', email);
      return await this.authService.generateBiometricChallenge(email);
    } catch (error: any) {
      console.error('❌ Biometric Challenge Error:', error.message);
      throw new BadRequestException(error.message);
    }
  }

  // ============================================
  // BIOMETRÍA: VERIFICAR Y LOGUEAR
  // ============================================
  @Mutation(() => LoginResponse)
  async verifyBiometricLogin(
    @Args('email') email: string,
    @Args('assertion') assertion: string,
  ) {
    try {
      console.log('🔑 Verificando firma biométrica para:', email);
      return await this.authService.verifyBiometricSignature(email, assertion);
    } catch (error: any) {
      console.error('❌ Biometric Verify Error:', error.message);
      throw new BadRequestException('Fallo en la verificación de identidad');
    }
  }

  // ============================================
  // 🔐 POST-QUANTUM: MIGRAR CUENTA
  // ============================================
  @Mutation(() => QuantumMigrationResponse)
  @UseGuards(GqlAuthGuard)
  async migrateToQuantumSafe(
    @CurrentUser() user: any,
    @Args('currentPassword') currentPassword: string
  ) {
    try {
      console.log('🔄 Migrando usuario a Post-Quantum:', user.email);
      const result = await this.authService.migrateToQuantumSafe(
        user._id,
        currentPassword
      );
      return {
        ...result,
        migratedAt: result.migratedAt?.toISOString()
      };
    } catch (error: any) {
      console.error('❌ Migration error:', error?.message);
      throw new BadRequestException(error?.message || 'Migration failed');
    }
  }

  // ============================================
  // 🔐 POST-QUANTUM: CAMBIAR CONTRASEÑA
  // ============================================
  @Mutation(() => MessageResponse)
  @UseGuards(GqlAuthGuard)
  async changePassword(
    @CurrentUser() user: any,
    @Args('input') input: ChangePasswordInput
  ) {
    try {
      console.log('🔑 Cambiando contraseña para:', user.email);
      const result = await this.authService.changePassword(
        user._id,
        input.currentPassword,
        input.newPassword,
        input.useQuantumSafe
      );
      return {
        message: result.message
      };
    } catch (error: any) {
      console.error('❌ Change password error:', error?.message);
      throw new BadRequestException(error?.message || 'Password change failed');
    }
  }

  // ============================================
  // 🔐 POST-QUANTUM: INFO DE SEGURIDAD
  // ============================================
  @Query(() => SecurityInfoResponse)
  @UseGuards(GqlAuthGuard)
  async mySecurityInfo(@CurrentUser() user: any) {
    try {
      console.log('🔍 Obteniendo info de seguridad para:', user.email);
      
      // Obtener usuario completo con info de crypto
      const fullUser = await this.authService.findOneById(user._id);
      
      if (!fullUser) {
        throw new BadRequestException('Usuario no encontrado');
      }

      return {
        email: fullUser.email,
        quantumSafeEnabled: fullUser.quantumSafeEnabled || false,
        cryptoAlgorithm: fullUser.cryptoAlgorithm || 'bcrypt',
        passwordChangedAt: fullUser.passwordChangedAt?.toISOString(),
        lastLogin: fullUser.lastLogin?.toISOString(),
        lastLoginQuantumSafe: fullUser.lastLoginQuantumSafe || false,
        twoFactorEnabled: fullUser.twoFactorAuth?.enabled || false,
        biometricEnabled: fullUser.securitySettings?.biometricEnabled || false
      };
    } catch (error: any) {
      console.error('❌ Security info error:', error?.message);
      throw new BadRequestException(error?.message || 'Failed to get security info');
    }
  }
}
