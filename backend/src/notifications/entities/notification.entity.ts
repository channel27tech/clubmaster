import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import { NotificationType } from '../enums/notification-type.enum';
import { NotificationStatus } from '../enums/notification-status.enum';
import { ApiProperty } from '@nestjs/swagger';

@Entity('notifications')
export class Notification {
  @ApiProperty({
    description: 'The unique identifier of the notification',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    description: 'The user ID of the notification recipient',
    example: '2ZO5zfxw6Ne0DvPu7AUk10hWnrn2',
  })
  @Column({ name: 'recipient_user_id', nullable: false, type: 'varchar' })
  recipientUserId: string;

  @ApiProperty({
    description: 'The user ID of the notification sender (if applicable)',
    example: '3ZP6zgyw7Of1EvQv8AVl21iXnsm3',
    nullable: true,
  })
  @Column({ name: 'sender_user_id', nullable: true, type: 'varchar' })
  senderUserId: string | null;

  @ApiProperty({
    description: 'The type of notification',
    enum: NotificationType,
    example: NotificationType.FRIEND_REQUEST,
  })
  @Column({
    type: 'enum',
    enum: NotificationType,
    nullable: false,
  })
  type: NotificationType;

  @ApiProperty({
    description: 'Additional data associated with the notification',
    example: {
      message: 'sent you a friend request',
      senderUserId: '3ZP6zgyw7Of1EvQv8AVl21iXnsm3',
      referenceId: '123e4567-e89b-12d3-a456-426614174000',
    },
  })
  @Column({ type: 'jsonb', default: {} })
  data: Record<string, any>;

  @ApiProperty({
    description: 'The read status of the notification',
    enum: NotificationStatus,
    example: NotificationStatus.UNREAD,
  })
  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.UNREAD,
  })
  status: NotificationStatus;

  @ApiProperty({
    description: 'When the notification was created',
    example: '2023-06-01T10:30:00Z',
  })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
} 