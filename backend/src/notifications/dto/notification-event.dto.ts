import { NotificationType } from '../enums/notification-type.enum';

/**
 * Data transfer object for notification events sent over WebSockets
 */
export class NotificationEventDto {
  /**
   * Unique identifier of the notification
   */
  id: string;

  /**
   * Type of notification
   */
  type: NotificationType;

  /**
   * User-friendly message for the notification
   */
  message: string;

  /**
   * Additional data related to the notification
   */
  data: Record<string, any>;

  /**
   * Timestamp when the notification was created
   */
  timestamp: Date;

  /**
   * ID of the user who sent the notification (if applicable)
   */
  senderUserId?: string;
} 