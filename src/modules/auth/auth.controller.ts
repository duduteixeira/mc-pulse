import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Webhook } from 'svix';
import { UsersService } from './users.service';

interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    email_addresses?: Array<{ email_address: string; id: string }>;
    primary_email_address_id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  };
}

/**
 * Webhook do Clerk. O payload é validado via assinatura Svix.
 * Em main.ts registramos raw body para esta rota.
 */
@Controller('webhooks/clerk')
export class AuthController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(200)
  async handleWebhook(
    @Req() req: Request,
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
  ): Promise<{ received: true }> {
    const secret = process.env.CLERK_WEBHOOK_SECRET;
    if (!secret) {
      throw new BadRequestException('CLERK_WEBHOOK_SECRET não configurado');
    }
    if (!svixId || !svixTimestamp || !svixSignature) {
      throw new BadRequestException('Headers Svix ausentes');
    }

    // req.body é Buffer (raw body) configurado em main.ts
    const rawBody = (req.body as Buffer).toString('utf8');

    let event: ClerkWebhookEvent;
    try {
      const wh = new Webhook(secret);
      event = wh.verify(rawBody, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as ClerkWebhookEvent;
    } catch {
      throw new BadRequestException('Assinatura Svix inválida');
    }

    if (event.type === 'user.created' || event.type === 'user.updated') {
      const primaryId = event.data.primary_email_address_id;
      const email =
        event.data.email_addresses?.find((e) => e.id === primaryId)?.email_address ??
        event.data.email_addresses?.[0]?.email_address;
      if (!email) throw new BadRequestException('Email ausente no payload Clerk');
      const name = [event.data.first_name, event.data.last_name].filter(Boolean).join(' ') || null;
      await this.usersService.findOrCreate({
        clerkId: event.data.id,
        email,
        name,
      });
    } else if (event.type === 'user.deleted') {
      await this.usersService.deleteByClerkId(event.data.id);
    }

    return { received: true };
  }
}
