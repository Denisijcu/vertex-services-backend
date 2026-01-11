import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
// Agregamos un chequeo de seguridad
export class GqlAuthGuard extends AuthGuard('jwt') {
  
  constructor() {
    super();
  }

  getRequest(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    
    // Si usas cookies, asegúrate de que lleguen aquí
    return request;
  }

  // AGREGAMOS ESTO PARA DEBUGUEAR EN RENDER
  handleRequest(err, user, info, context, status) {
    if (err || !user) {
      console.error('❌ Error en GqlAuthGuard:', info?.message);
      throw err || new Error('Acceso denegado: Token inválido o ausente');
    }
    return user;
  }
}
