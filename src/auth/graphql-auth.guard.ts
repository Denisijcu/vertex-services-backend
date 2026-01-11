
import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GqlAuthGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext) {
    // GraphQL necesita el contexto de forma diferente que una API REST
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req;
  }
}