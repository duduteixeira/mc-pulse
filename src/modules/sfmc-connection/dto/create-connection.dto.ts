import { IsEnum, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { IntegrationType } from '@prisma/client';

export class CreateConnectionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  /**
   * Subdomínio SFMC (ex: mc6xxxxxxxxxxxxxxxxxx). Sem https:// nem .rest...
   */
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'subdomain deve conter apenas letras minúsculas, números e hífens',
  })
  @MaxLength(100)
  subdomain!: string;

  @IsString()
  @IsNotEmpty()
  accountId!: string;

  @IsString()
  @IsNotEmpty()
  clientId!: string;

  @IsString()
  @IsNotEmpty()
  clientSecret!: string;

  @IsEnum(IntegrationType)
  integrationType!: IntegrationType;
}
