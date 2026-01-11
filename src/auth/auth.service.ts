import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { User, UserDocument } from '../user.schema';
import { PostQuantumCryptoService } from '../crypto/post-quantum-crypto.service'; // ✅ AGREGAR

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private postQuantumCrypto: PostQuantumCryptoService, // ✅ INYECTAR
  ) { }

  // ============================================
  // 1. REGISTRO DE USUARIO
  // ============================================
  async register(
    email: string,
    password: string,
    name: string,
    role?: string,
    termsAccepted?: boolean
  ) {
    try {
      // Validaciones
      if (!email || !password || !name) {
        throw new BadRequestException('All fields are required');
      }

      if (!termsAccepted) {
        throw new BadRequestException('You must accept the Terms of Service and Privacy Policy');
      }

      // Verificar si ya existe
      const existingUser = await this.userModel.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        throw new BadRequestException('Email is already registered');
      }

      // Validar contraseña fuerte
      if (password.length < 8) {
        throw new BadRequestException('Password must be at least 8 characters long');
      }

      // 🔐 USAR BCRYPT TEMPORALMENTE (sin post-quantum por ahora)
      const hashedPassword = await bcrypt.hash(password, 10);

      // Generar token de verificación de email
      const emailVerificationToken = this.generateRandomToken();

      // Crear usuario
      const newUser = new this.userModel({
        email: email.toLowerCase(),
        password: hashedPassword,
        name,
        role: role || 'CLIENT',
        emailVerificationToken,
        emailVerified: false,
        termsAcceptedAt: new Date(),
        stats: {
          jobsCompleted: 0,
          jobsReceived: 0,
          totalEarned: 0,
          totalSpent: 0,
          averageRating: 5.0,
          totalReviews: 0
        }
      });

      await newUser.save();

      console.log(`📧 Email verification: http://localhost:4200/verify-email?token=${emailVerificationToken}`);

      return {
        message: 'User registered successfully. Please verify your email to activate your account.',
        emailVerificationToken
      };
    } catch (error) {
      console.error('❌ Register error:', error);
      throw error;
    }
  }

  // ============================================
  // 2. LOGIN (SOPORTA AMBOS: bcrypt y post-quantum)
  // ============================================
// ============================================
  // 2. LOGIN (SOPORTA AMBOS: bcrypt y post-quantum)
  // ============================================
  async login(email: string, password: string, twoFactorCode?: string) {
    const user = await this.userModel.findOne({ email: email.toLowerCase() });

    if (!user) {
      throw new BadRequestException('Credenciales inválidas');
    }

    // 🔐 VERIFICAR: Si tiene salt, usa post-quantum. Si no, usa bcrypt (compatibilidad)
    let isPasswordValid = false;

    if (user.passwordSalt) {
      try {
        isPasswordValid = this.postQuantumCrypto.verifyPassword(
          password,
          user.password,
          user.passwordSalt
        );
      } catch (error) {
        console.error('❌ Verify error:', error);
        isPasswordValid = false;
      }
    } else {
      // Usuario legacy (bcrypt)
      isPasswordValid = await bcrypt.compare(password, user.password);
    }

    if (!isPasswordValid) {
      throw new BadRequestException('Credenciales inválidas');
    }

    // Verificar si está activo
    if (!user.isActive) {
      throw new BadRequestException('Tu cuenta ha sido desactivada');
    }

    // Si tiene 2FA habilitado, verificar código
    if (user.twoFactorAuth?.enabled) {
      if (!twoFactorCode) {
        return {
          requiresTwoFactor: true,
          message: 'Se requiere código de autenticación de dos factores'
        };
      }

      const isValid = speakeasy.totp.verify({
        secret: user.twoFactorAuth.secret,
        encoding: 'base32',
        token: twoFactorCode,
        window: 2
      });

      if (!isValid) {
        throw new BadRequestException('Código 2FA inválido');
      }
    }

    // Actualizar último login
    user.lastLogin = new Date();
    user.lastLoginQuantumSafe = user.passwordSalt ? true : false;
    await user.save();

    // Crear payload del token
    const payload = {
      email: user.email,
      sub: user._id,
      name: user.name,
      role: user.role,
      quantumSafe: user.passwordSalt ? true : false
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        emailVerified: user.emailVerified
      }
    };
  }

  // ============================================
  // 3. VERIFICAR EMAIL (SIN CAMBIOS)
  // ============================================
  async verifyEmail(token: string) {
    const user = await this.userModel.findOne({ emailVerificationToken: token });

    if (!user) {
      throw new BadRequestException('Token inválido o expirado');
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    await user.save();

    return { message: 'Email verificado exitosamente' };
  }

  // ============================================
  // 4. HABILITAR 2FA (SIN CAMBIOS)
  // ============================================
  async enable2FA(userId: string) {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    if (user.twoFactorAuth?.enabled) {
      throw new BadRequestException('2FA ya está habilitado');
    }

    const secret = speakeasy.generateSecret({
      name: `Vertex Amazon (${user.email})`,
      issuer: 'Vertex'
    });

    const backupCodes = this.generateBackupCodes(6);

    user.twoFactorAuth = {
      enabled: false,
      secret: secret.base32,
      backupCodes: backupCodes.map(code => bcrypt.hashSync(code, 10))
    };

    await user.save();

    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    return {
      qrCode: qrCodeUrl,
      secret: secret.base32,
      backupCodes
    };
  }

  // ============================================
  // 5. CONFIRMAR 2FA (SIN CAMBIOS)
  // ============================================
  async confirm2FA(userId: string, code: string) {
    const user = await this.userModel.findById(userId);

    if (!user || !user.twoFactorAuth?.secret) {
      throw new BadRequestException('2FA no iniciado');
    }

    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorAuth.secret,
      encoding: 'base32',
      token: code,
      window: 2
    });

    if (!isValid) {
      throw new UnauthorizedException('Código inválido');
    }

    user.twoFactorAuth.enabled = true;
    await user.save();

    return { message: '2FA habilitado exitosamente' };
  }

  // ============================================
  // 6. DESHABILITAR 2FA (SIN CAMBIOS)
  // ============================================
  async disable2FA(userId: string, code: string) {
    const user = await this.userModel.findById(userId);

    if (!user || !user.twoFactorAuth?.enabled) {
      throw new BadRequestException('2FA no está habilitado');
    }

    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorAuth.secret,
      encoding: 'base32',
      token: code,
      window: 2
    });

    if (!isValid) {
      throw new UnauthorizedException('Código inválido');
    }

    user.twoFactorAuth = {
      enabled: false,
      secret: undefined,
      backupCodes: []
    };

    await user.save();

    return { message: '2FA deshabilitado exitosamente' };
  }

  // ============================================
  // 7. RECUPERAR CONTRASEÑA (SIN CAMBIOS)
  // ============================================
  async forgotPassword(email: string) {
    const user = await this.userModel.findOne({ email: email.toLowerCase() });

    if (!user) {
      return { message: 'Si el email existe, recibirás instrucciones de recuperación' };
    }

    const resetToken = this.generateRandomToken();
    const resetExpires = new Date(Date.now() + 3600000); // 1 hora

    return { message: 'Si el email existe, recibirás instrucciones de recuperación' };
  }

  // ============================================
  // HELPERS
  // ============================================
  private generateRandomToken(): string {
    return require('crypto').randomBytes(32).toString('hex');
  }

  private generateBackupCodes(count: number): string[] {
    const codes = [];
    for (let i = 0; i < count; i++) {
      codes.push(
        Math.random().toString(36).substring(2, 10).toUpperCase()
      );
    }
    return codes;
  }

  async findOneById(id: string) {
    return this.userModel.findById(id).select('-password').exec();
  }
}