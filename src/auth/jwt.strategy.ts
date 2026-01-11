import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from './user.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private userService: UserService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(), // 👈 Desde Authorization header
        (request) => {
          // 👈 También desde cookies (si existen)
          return request?.cookies?.token || null;
        }
      ]),
      ignoreExpiration: false,
      secretOrKey: 'vertex-secret-key-2024-super-secure',
    });
  }

  async validate(payload: any) {
    // Buscamos al usuario en la DB para asegurar que existe
    const user = await this.userService.findOneById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    return user;
  }
}