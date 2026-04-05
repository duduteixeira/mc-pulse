import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { verifyToken, createClerkClient } from '@clerk/clerk-sdk-node';
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
    // Aceita Authorization header OU ?access_token= (necessário para SSE/EventSource)
    const authHeader = req.headers.authorization;
    const queryToken =
      typeof req.query?.access_token === 'string' ? req.query.access_token : undefined;

    let token: string;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice('Bearer '.length);
    } else if (queryToken) {
      token = queryToken;
    } else {
      throw new UnauthorizedException('Bearer token ausente');
    }

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

      let user = await this.usersService.findByClerkId(clerkId);

      // Auto-sync: se o usuário ainda não existe localmente (p. ex. webhook
      // ainda não configurado em dev), busca no Clerk e cria tenant + user.
      if (!user) {
        try {
          const clerkClient = createClerkClient({ secretKey });
          const clerkUser = await clerkClient.users.getUser(clerkId);
          const email =
            clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
              ?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;
          if (!email) {
            throw new UnauthorizedException('Usuário Clerk sem email');
          }
          const name =
            [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || null;
          user = await this.usersService.findOrCreate({ clerkId, email, name });
        } catch (syncErr) {
          if (syncErr instanceof UnauthorizedException) throw syncErr;
          throw new UnauthorizedException(
            `Falha ao sincronizar usuário: ${(syncErr as Error).message}`,
          );
        }
      }

      req.auth = { userId: user.id, tenantId: user.tenantId };
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Falha ao validar token Clerk');
    }
  }
}
