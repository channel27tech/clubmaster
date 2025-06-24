import { ApiProperty } from '@nestjs/swagger';

export class FriendResponseDto {
  @ApiProperty({
    description: 'The ID of the friend',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'The username of the friend',
    example: 'chessmaster42',
  })
  username: string;

  @ApiProperty({
    description: 'The URL to the friend\'s avatar',
    example: 'https://example.com/avatars/user123.jpg',
    nullable: true,
  })
  avatarUrl: string | null;

  @ApiProperty({
    description: 'The chess rating of the friend',
    example: 1500,
    nullable: true,
  })
  rating: number | null;
} 