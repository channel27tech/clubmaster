import { IsEmail, IsString, IsUrl, IsBoolean, IsOptional } from 'class-validator';

export class SyncUserDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsUrl()
  photoURL?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;
} 