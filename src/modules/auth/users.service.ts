import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { User } from '@prisma/client';

export interface ClerkUserPayload {
  clerkId: string;
  email: string;
  name?: string | null;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByClerkId(clerkId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { clerkId } });
  }

  /**
   * Cria usuário + tenant próprio na primeira vez que o Clerk envia `user.created`.
   * Cada usuário novo ganha seu próprio Tenant (OWNER). Convites para tenants existentes
   * ficam para fase futura.
   */
  async findOrCreate(payload: ClerkUserPayload): Promise<User> {
    const existing = await this.findByClerkId(payload.clerkId);
    if (existing) return existing;

    const tenant = await this.prisma.tenant.create({
      data: {
        name: payload.name ?? payload.email,
      },
    });

    const user = await this.prisma.user.create({
      data: {
        clerkId: payload.clerkId,
        email: payload.email,
        name: payload.name ?? null,
        role: 'OWNER',
        tenantId: tenant.id,
      },
    });

    this.logger.log(`Novo usuário sincronizado: ${user.id} (tenant ${tenant.id})`);
    return user;
  }

  async deleteByClerkId(clerkId: string): Promise<void> {
    const user = await this.findByClerkId(clerkId);
    if (!user) return;
    // Remove o tenant inteiro se o usuário for OWNER único (cascade no schema remove resto)
    const tenantUsers = await this.prisma.user.count({ where: { tenantId: user.tenantId } });
    if (tenantUsers <= 1) {
      await this.prisma.tenant.delete({ where: { id: user.tenantId } });
    } else {
      await this.prisma.user.delete({ where: { id: user.id } });
    }
  }
}
