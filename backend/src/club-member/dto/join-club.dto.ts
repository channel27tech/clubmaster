import { IsInt, Min, IsString, IsOptional } from 'class-validator';
 
export class JoinClubDto {
  @IsInt()
  @Min(1)
  clubId: number;

  @IsString()
  @IsOptional()
  inviteToken?: string;
} 