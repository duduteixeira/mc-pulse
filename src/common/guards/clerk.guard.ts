import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { verifyToken } from '@clerk/clerk-sdk-node';
import { Request } from 'express';
import { UsersService } from '../../modules/auth/users.service';

export interface AuthenticatedRequest extends Request {
  auth: {
    userId: string;
    tenantId: string;
  };
}

/**
 * Guard que valida o JWT emitido pelo Clerk.
 * Após validação, popula req.auth com userId e tenantId.
 */
@Injectable()
export class ClerkGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token ausente');
    }
    const token = authHeader.slice('Bearer '.length);

    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      throw new UnauthorizedException('Clerk não configurado');
    }

    try {
      const payload = await verifyToken(token, { secretKey });
      const clerkId = payload.sub;
      if (!clerkId) {
        throw new UnauthorizedException('Token Clerk inválido: sub ausente');
      }

      const user = await this.usersService.findByClerkId(clerkId);
      if (!user) {
        throw new UnauthorizedException('Usuário não sincronizado');
      }

      req.auth = { userId: user.id, tenantId: user.tenantId };
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Falha ao validar token Clerk');
    }
  }
}
