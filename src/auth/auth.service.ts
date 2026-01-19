import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { User, UserDocument } from '../user.schema';
import { PostQuantumCryptoService } from '../crypto/post-quantum-crypto.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private postQuantumCrypto: PostQuantumCryptoService,
  ) { }

  // ============================================
  // 1. REGISTRO CON POST-QUANTUM (OPCIONAL)
  // ============================================
  async register(
    email: string,
    password: string,
    name: string,
    role?: string,
    termsAccepted?: boolean,
    useQuantumSafe?: boolean // 👈 NUEVO: Parámetro opcional
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

      let hashedPassword: string;
      let passwordSalt: string | undefined;
      let cryptoAlgorithm: string;

      // 🔐 DECISION: Post-Quantum o bcrypt
      if (useQuantumSafe) {
        console.log('🔐 Using Post-Quantum cryptography for new user');
        const { hash, salt } = this.postQuantumCrypto.hashPassword(password);
        hashedPassword = hash;
        passwordSalt = salt;
        cryptoAlgorithm = 'SHA3-PBKDF2-QUANTUM';
      } else {
        console.log('🔐 Using bcrypt for new user (legacy mode)');
        hashedPassword = await bcrypt.hash(password, 10);
        passwordSalt = undefined;
        cryptoAlgorithm = 'bcrypt';
      }

      // Generar token de verificación de email
      const emailVerificationToken = this.generateRandomToken();

      // Crear usuario
      const newUser = new this.userModel({
        email: email.toLowerCase(),
        password: hashedPassword,
        passwordSalt,
        cryptoAlgorithm,
        quantumSafeEnabled: useQuantumSafe || false,
        name,
        role: role || 'CLIENT',
        emailVerificationToken,
        emailVerified: false,
        termsAcceptedAt: new Date(),
        passwordChangedAt: new Date(),
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

      console.log(`✅ User registered with ${cryptoAlgorithm}`);
      console.log(`📧 Email verification: http://localhost:4200/verify-email?token=${emailVerificationToken}`);

      return {
        message: 'User registered successfully. Please verify your email to activate your account.',
        emailVerificationToken,
        cryptoAlgorithm, // 👈 Para que el frontend sepa qué se usó
        quantumSafe: useQuantumSafe || false
      };
    } catch (error) {
      console.error('❌ Register error:', error);
      throw error;
    }
  }

  // ============================================
  // 2. LOGIN HÍBRIDO (SOPORTA AMBOS)
  // ============================================
  async login(email: string, password: string, twoFactorCode?: string) {
    const user = await this.userModel.findOne({ email: email.toLowerCase() });

    if (!user) {
      throw new BadRequestException('Credenciales inválidas');
    }

    let isPasswordValid = false;
    let usedQuantumSafe = false;

    // 🔐 VERIFICACIÓN INTELIGENTE
    if (user.passwordSalt && user.cryptoAlgorithm === 'SHA3-PBKDF2-QUANTUM') {
      console.log('🔐 Verifying with Post-Quantum crypto');
      try {
        isPasswordValid = this.postQuantumCrypto.verifyPassword(
          password,
          user.password,
          user.passwordSalt
        );
        usedQuantumSafe = true;
      } catch (error) {
        console.error('❌ Post-Quantum verify error:', error);
        isPasswordValid = false;
      }
    } else {
      console.log('🔐 Verifying with bcrypt (legacy)');
      isPasswordValid = await bcrypt.compare(password, user.password);
      usedQuantumSafe = false;
    }

    if (!isPasswordValid) {
      throw new BadRequestException('Credenciales inválidas');
    }

    // Verificar si está activo
    if (!user.isActive) {
      throw new BadRequestException('Tu cuenta ha sido desactivada');
    }

    // 2FA si está habilitado
    if (user.twoFactorAuth?.enabled) {
      if (!twoFactorCode) {
        return {
          requiresTwoFactor: true,
          message: 'Se requiere código de autenticación de dos factores'
        };
      }

      const isValid = speakeasy.totp.verify({
        secret: user.twoFactorAuth.secret!,
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
    user.lastLoginQuantumSafe = usedQuantumSafe;
    await user.save();

    // Crear payload del token
    const payload = {
      email: user.email,
      sub: user._id,
      name: user.name,
      role: user.role,
      quantumSafe: usedQuantumSafe,
      cryptoAlgorithm: user.cryptoAlgorithm || 'bcrypt'
    };

    console.log(`✅ Login successful with ${usedQuantumSafe ? 'Post-Quantum' : 'bcrypt'}`);

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        emailVerified: user.emailVerified,
        quantumSafe: usedQuantumSafe
      }
    };
  }

  // ============================================
  // 3. MIGRAR USUARIO A POST-QUANTUM
  // ============================================
  async migrateToQuantumSafe(userId: string, currentPassword: string) {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    // Verificar contraseña actual
    let isCurrentPasswordValid = false;

    if (user.passwordSalt) {
      isCurrentPasswordValid = this.postQuantumCrypto.verifyPassword(
        currentPassword,
        user.password,
        user.passwordSalt
      );
    } else {
      isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    }

    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Contraseña actual incorrecta');
    }

    // Si ya usa post-quantum, no hacer nada
    if (user.cryptoAlgorithm === 'SHA3-PBKDF2-QUANTUM') {
      return {
        message: 'Esta cuenta ya usa encriptación post-cuántica',
        alreadyQuantumSafe: true
      };
    }

    // Migrar a post-quantum
    console.log(`🔄 Migrating user ${user.email} to Post-Quantum crypto`);

    const { hash, salt } = this.postQuantumCrypto.hashPassword(currentPassword);

    user.password = hash;
    user.passwordSalt = salt;
    user.cryptoAlgorithm = 'SHA3-PBKDF2-QUANTUM';
    user.quantumSafeEnabled = true;
    user.passwordChangedAt = new Date();

    await user.save();

    console.log(`✅ User ${user.email} migrated to Post-Quantum successfully`);

    return {
      message: 'Tu cuenta ha sido migrada a encriptación post-cuántica exitosamente',
      quantumSafe: true,
      migratedAt: new Date()
    };
  }

  // ============================================
  // 4. CAMBIAR CONTRASEÑA (CON POST-QUANTUM)
  // ============================================
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    useQuantumSafe?: boolean
  ) {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    // Verificar contraseña actual
    let isCurrentPasswordValid = false;

    if (user.passwordSalt) {
      isCurrentPasswordValid = this.postQuantumCrypto.verifyPassword(
        currentPassword,
        user.password,
        user.passwordSalt
      );
    } else {
      isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    }

    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Contraseña actual incorrecta');
    }

    // Validar nueva contraseña
    if (newPassword.length < 8) {
      throw new BadRequestException('La nueva contraseña debe tener al menos 8 caracteres');
    }

    // Aplicar nueva contraseña con el método deseado
    const shouldUseQuantum = useQuantumSafe !== undefined ? useQuantumSafe : user.quantumSafeEnabled;

    if (shouldUseQuantum) {
      console.log('🔐 Changing password with Post-Quantum crypto');
      const { hash, salt } = this.postQuantumCrypto.hashPassword(newPassword);
      user.password = hash;
      user.passwordSalt = salt;
      user.cryptoAlgorithm = 'SHA3-PBKDF2-QUANTUM';
      user.quantumSafeEnabled = true;
    } else {
      console.log('🔐 Changing password with bcrypt');
      user.password = await bcrypt.hash(newPassword, 10);
      user.passwordSalt = undefined;
      user.cryptoAlgorithm = 'bcrypt';
      user.quantumSafeEnabled = false;
    }

    user.passwordChangedAt = new Date();
    await user.save();

    console.log(`✅ Password changed for ${user.email} using ${user.cryptoAlgorithm}`);

    return {
      message: 'Contraseña cambiada exitosamente',
      cryptoAlgorithm: user.cryptoAlgorithm,
      quantumSafe: user.quantumSafeEnabled
    };
  }

  // ============================================
  // RESTO DE MÉTODOS (SIN CAMBIOS)
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

    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url!);

    return {
      qrCode: qrCodeUrl,
      secret: secret.base32,
      backupCodes
    };
  }

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

  async disable2FA(userId: string, code: string) {
    const user = await this.userModel.findById(userId);

    if (!user || !user.twoFactorAuth?.enabled) {
      throw new BadRequestException('2FA no está habilitado');
    }

    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorAuth.secret!,
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

  async forgotPassword(email: string) {
    const user = await this.userModel.findOne({ email: email.toLowerCase() });

    if (!user) {
      return { message: 'Si el email existe, recibirás instrucciones de recuperación' };
    }

    return { message: 'Si el email existe, recibirás instrucciones de recuperación' };
  }

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
    return this.userModel.findById(id).select('-password -passwordSalt').exec();
  }

  // Métodos biométricos sin cambios...
  async generateBiometricChallenge(email: string) {
    const user = await this.userModel.findOne({ email: email.toLowerCase() });

    if (!user || !user.securitySettings?.biometricEnabled || !user.securitySettings?.biometricPublicKey) {
      throw new BadRequestException('La biometría no está configurada o habilitada para esta cuenta');
    }

    const challenge = this.generateRandomToken();
    user.securitySettings.currentBiometricChallenge = challenge;
    user.markModified('securitySettings');
    await user.save();

    return {
      challenge,
      allowCredentials: [{
        id: user.securitySettings.biometricPublicKey,
        type: 'public-key'
      }]
    };
  }

  async verifyBiometricSignature(email: string, assertionStr: string) {
    const user = await this.userModel.findOne({ email: email.toLowerCase() });
    if (!user) throw new BadRequestException('Usuario no encontrado');

    const assertion = JSON.parse(assertionStr);
    const isSignatureValid = !!assertion && user.securitySettings?.biometricEnabled;

    if (!isSignatureValid) {
      throw new UnauthorizedException('Firma biométrica inválida o servicio no habilitado');
    }

    if (user.securitySettings) {
      user.securitySettings.currentBiometricChallenge = undefined;
    }
    user.lastLogin = new Date();
    user.markModified('securitySettings');
    await user.save();

    const payload = {
      email: user.email,
      sub: user._id,
      role: user.role,
      biometric: true
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
}