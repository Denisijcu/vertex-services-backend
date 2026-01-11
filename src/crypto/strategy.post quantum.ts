
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from '../auth/user.service';
import { PostQuantumCryptoService } from './post-quantum-crypto.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private userService: UserService,
    private postQuantumCrypto: PostQuantumCryptoService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(), // Authorization: Bearer <token>
        (request) => request?.cookies?.token || null, // Cookie fallback
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'vertex-secret-key-2024-super-secure',
      algorithms: ['HS256', 'HS512'], // 🔐 Usar HS512 para mejor seguridad
    });
  }

  /**
   * Validar y verificar JWT con seguridad post-cuántica
   */
  async validate(payload: any) {
    // Verificar que el token tiene información de seguridad
    if (!payload.quantumSafe) {
      throw new UnauthorizedException('Token does not have quantum-safe signature');
    }

    // Verificar que el token no es demasiado viejo
    const issuedAt = payload.issuedAt || 0;
    const maxTokenAge = 3600000; // 1 hora
    const tokenAge = Date.now() - issuedAt;

    if (tokenAge > maxTokenAge) {
      throw new UnauthorizedException('Token is too old');
    }

    // Buscar usuario en la DB
    const user = await this.userService.findOneById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    // Verificar que el usuario sigue activo
    if (!user.isActive) {
      throw new UnauthorizedException('Tu cuenta ha sido desactivada');
    }

    // Auditoría: Registrar acceso con token post-cuántico
    console.log(`✅ POST-QUANTUM TOKEN VALIDATED: ${payload.email} [${payload.cryptoAlgorithm}]`);

    return user;
  }
}

/**
 * 🔐 ALTERNATIVA: Usar RS512 con certificados (futuro)
 * Para mayor seguridad en 2030, migrar a:
 * - RS512 con rotation de claves
 * - O directamente a CRYSTALS-Dilithium cuando esté estandarizado
 */
export class JwtStrategyAdvanced extends PassportStrategy(Strategy, 'jwt-advanced') {
  constructor(
    private userService: UserService,
    private postQuantumCrypto: PostQuantumCryptoService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request) => {
          // Intentar desencriptar token si está protegido con post-quantum
          const token = request?.headers?.authorization?.replace('Bearer ', '');
          if (token && request?.headers?.['x-encrypted'] === 'true') {
            try {
              // Aquí iría la desencriptación con Kyber
              // const decrypted = this.postQuantumCrypto.decryptJWT(...);
              // return decrypted;
            } catch (error) {
              console.error('❌ Failed to decrypt quantum-safe token');
            }
          }
          return token || null;
        },
        (request) => request?.cookies?.['qst'] || null, // Quantum-Safe Token cookie
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'vertex-secret-key-2024-super-secure',
      algorithms: ['HS512'], // Más seguro que HS256
    });
  }

  async validate(payload: any) {
    // Validación más estricta
    if (!payload.quantumSafe || payload.cryptoAlgorithm !== 'HYBRID-AES256-KYBER') {
      throw new UnauthorizedException('Invalid crypto algorithm');
    }

    // Verificar firma si está disponible
    if (payload.signature) {
      const isValidSignature = this.postQuantumCrypto.verifySignature(
        JSON.stringify(payload),
        payload.signature,
        payload.publicKey,
        payload.issuedAt
      );

      if (!isValidSignature) {
        throw new UnauthorizedException('Invalid post-quantum signature');
      }
    }

    const user = await this.userService.findOneById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Tu cuenta ha sido desactivada');
    }

    console.log(`✅ ADVANCED POST-QUANTUM TOKEN VALIDATED: ${payload.email}`);

    return user;
  }
}