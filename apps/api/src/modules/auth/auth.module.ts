import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { UsersService } from './users.service';
import { ClerkGuard } from '../../common/guards/clerk.guard';

@Global()
@Module({
  controllers: [AuthController],
  providers: [UsersService, ClerkGuard],
  exports: [UsersService, ClerkGuard],
})
export class AuthModule {}
