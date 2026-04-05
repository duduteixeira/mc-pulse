import { IsEnum } from 'class-validator';
import { FindingStatus } from '@prisma/client';

export class UpdateFindingDto {
  @IsEnum(FindingStatus)
  status!: FindingStatus;
}
