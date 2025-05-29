import { IsString, IsNotEmpty, IsIn, IsOptional, IsInt } from 'class-validator';

export class CreateClubDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  location: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  logo: string;

  @IsString()
  @IsIn(['public', 'private_by_invite', 'private_by_rating', 'private_by_location'])
  type: 'public' | 'private_by_invite' | 'private_by_rating' | 'private_by_location';

  @IsOptional()
  @IsInt()
  ratingLimit?: number;
} 