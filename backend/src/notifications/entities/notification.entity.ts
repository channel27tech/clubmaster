import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import { NotificationType } from '../enums/notification-type.enum';
import { NotificationStatus } from '../enums/notification-status.enum';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'recipient_user_id', nullable: false, type: 'varchar' })
  recipientUserId: string;

  @Column({ name: 'sender_user_id', nullable: true, type: 'varchar' })
  senderUserId: string | null;

  @Column({
    type: 'enum',
    enum: NotificationType,
    nullable: false,
  })
  type: NotificationType;

  @Column({ type: 'jsonb', default: {} })
  data: Record<string, any>;

  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.UNREAD,
  })
  status: NotificationStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
} 