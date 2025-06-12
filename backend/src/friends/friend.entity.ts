import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum FriendStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

@Entity('friends')
export class Friend {
  @ApiProperty({
    description: 'The unique identifier of the friendship',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    description: 'The user ID of the requester',
    example: '2ZO5zfxw6Ne0DvPu7AUk10hWnrn2',
  })
  @Column({ type: 'varchar', length: 36 })
  userId: string;

  @ApiProperty({
    description: 'The user ID of the friend/recipient',
    example: '3ZP6zgyw7Of1EvQv8AVl21iXnsm3',
  })
  @Column({ type: 'varchar', length: 36 })
  friendId: string;

  @ApiProperty({
    description: 'The current status of the friendship',
    enum: FriendStatus,
    example: FriendStatus.ACCEPTED,
  })
  @Column({
    type: 'enum',
    enum: FriendStatus,
    default: FriendStatus.PENDING,
  })
  status: FriendStatus;

  @ApiProperty({
    description: 'When the friendship was created',
    example: '2023-06-01T10:30:00Z',
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    description: 'When the friendship was last updated',
    example: '2023-06-02T15:45:00Z',
  })
  @UpdateDateColumn()
  updatedAt: Date;
} 