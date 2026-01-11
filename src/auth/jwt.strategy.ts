import { Injectable, UnauthorizedException, Inject, forwardRef } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
// Asegúrate de que esta importación sea exacta
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from './user.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    // Usamos forwardRef por si UserService también importa AuthModule
    @Inject(forwardRef(() => UserService))
    private userService: UserService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request: any) => {
          return request?.cookies?.token || null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: 'vertex-secret-key-2024-super-secure', // Asegúrate de que esto coincida con tu AuthModule
    });
  }

  async validate(payload: any) {
    // payload.sub suele ser el ID del usuario
    const user = await this.userService.findOneById(payload.sub);
    
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado en Vertex');
    }
    
    return user; // Nest lo inyecta en req.user
  }
}
