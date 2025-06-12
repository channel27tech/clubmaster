import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendFriendRequestDto {
  @ApiProperty({
    description: 'The ID of the user to send a friend request to',
    example: '2ZO5zfxw6Ne0DvPu7AUk10hWnrn2',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[a-zA-Z0-9]{20,36}$/, {
    message: 'friendId must be a valid Firebase UID (20-36 alphanumeric characters)',
  })
  friendId: string;
} 