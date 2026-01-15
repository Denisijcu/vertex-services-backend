import { Injectable, UnauthorizedException, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from './user.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(forwardRef(() => UserService))
    private userService: UserService,
    configService: ConfigService,
  ) {
    const secretKey = configService.get<string>('JWT_SECRET') || 'vertex-secret-key-2024-super-secure';
    
    console.log('✅ JwtStrategy inicializado');
    console.log('🔐 Secret (primeros 20 chars):', secretKey.substring(0, 20) + '...');
    console.log('🔐 Secret length:', secretKey.length);
    
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request: any) => {
          const cookieToken = request?.cookies?.token;
          if (cookieToken) {
            console.log('🍪 Token extraído de cookie');
          }
          return cookieToken || null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: secretKey,
      // 🔥 FIX CRÍTICO: Aceptar múltiples algoritmos
      algorithms: ['HS256', 'HS384', 'HS512'],
    });
  }

  async validate(payload: any) {
    console.log('🔑 JWT Strategy - validate() llamado');
    console.log('📦 Payload completo:', JSON.stringify(payload, null, 2));
    
    const userId = payload.sub || payload.id || payload._id || payload.userId;
    
    console.log('🆔 User ID extraído del payload:', userId);
    
    if (!userId) {
      console.error('❌ ERROR: No se encontró user ID en el payload');
      throw new UnauthorizedException('Token inválido - no contiene ID de usuario');
    }
    
    try {
      console.log('🔍 Buscando usuario en BD con ID:', userId);
      
      const user = await this.userService.findOneById(userId.toString());
      
      if (!user) {
        console.error('❌ Usuario no encontrado en BD para ID:', userId);
        throw new UnauthorizedException('Usuario no encontrado en Vertex');
      }
      
      console.log('✅ Usuario encontrado y validado:', {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      });
      
      return user;
      
    } catch (error: any) {
      console.error('❌ Error en validate():', error.message);
      throw new UnauthorizedException('Error al validar usuario: ' + error.message);
    }
  }
}