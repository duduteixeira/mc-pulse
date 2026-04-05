import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedRequest } from '../guards/clerk.guard';

/**
 * Extrai o tenantId do request autenticado pelo ClerkGuard.
 * Uso: `@Tenant() tenantId: string`
 */
export const Tenant = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  return req.auth.tenantId;
});

/**
 * Extrai o userId (interno) do request autenticado.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return req.auth.userId;
  },
);
