import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { NotificationType } from '../enums/notification-type.enum';
import { Type } from 'class-transformer';

export class CreateNotificationDto {
  @IsNotEmpty()
  @IsString()
  recipientUserId: string;

  @IsOptional()
  @IsString()
  senderUserId?: string;

  @IsNotEmpty()
  @IsEnum(NotificationType)
  type: NotificationType;

  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  data?: Record<string, any>;
} 