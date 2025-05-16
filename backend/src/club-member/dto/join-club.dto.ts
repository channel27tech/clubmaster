import { IsInt, Min } from 'class-validator';
 
export class JoinClubDto {
  @IsInt()
  @Min(1)
  clubId: number;
} 