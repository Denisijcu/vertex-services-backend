import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GqlAuthGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    
    console.log('🛡️ GqlAuthGuard - getRequest() llamado');
    console.log('🛡️ Authorization Header:', request?.headers?.authorization ? 'Presente ✅' : 'Ausente ❌');
    console.log('🛡️ Cookie token:', request?.cookies?.token ? 'Presente ✅' : 'Ausente ❌');
    
    return request;
  }

  handleRequest<TUser = any>(
    err: any,
    user: any,
    info: any,
   // context: ExecutionContext,
  ): TUser {
    console.log('🛡️ GqlAuthGuard - handleRequest() llamado');
    console.log('🛡️ Error:', err?.message || 'Sin error');
    console.log('🛡️ User recibido:', user ? `✅ ${user.email}` : '❌ No user');
    console.log('🛡️ Info:', info?.message || 'Sin info');
    
    if (err) {
      console.error('❌ Guard detectó error:', err);
      throw err;
    }
    
    if (!user) {
      console.error('❌ Guard: No user en handleRequest');
      console.error('❌ Posible causa: Token expirado, inválido o no enviado');
      throw new UnauthorizedException('No autorizado - Token inválido o ausente');
    }
    
    console.log('✅ Guard aprobó request para usuario:', user.email);
    return user;
  }
}