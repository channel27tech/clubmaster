import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { NotificationStatus } from './enums/notification-status.enum';
import { NotificationType } from './enums/notification-type.enum';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationEventDto } from './dto/notification-event.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationsRepository: Repository<Notification>,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  /**
   * Create a new notification
   * @param createNotificationDto - Data to create the notification
   * @returns The created notification
   */
  async createNotification(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    // Duplicate prevention for CLUB_MEMBER_LEFT
    if (createNotificationDto.type === NotificationType.CLUB_MEMBER_LEFT) {
      const existing = await this.notificationsRepository.findOne({
        where: {
          recipientUserId: createNotificationDto.recipientUserId,
          type: createNotificationDto.type,
          status: NotificationStatus.UNREAD,
          // Check for same clubId and memberName in data
          data: {
            clubId: createNotificationDto.data?.clubId,
            memberName: createNotificationDto.data?.memberName,
          },
        },
      });
      if (existing) {
        return existing;
      }
    }
    const notification = this.notificationsRepository.create({
      recipientUserId: createNotificationDto.recipientUserId,
      senderUserId: createNotificationDto.senderUserId || null,
      type: createNotificationDto.type,
      data: createNotificationDto.data || {},
      status: NotificationStatus.UNREAD,
    });

    const savedNotification = await this.notificationsRepository.save(notification);
    
    // Emit real-time notification to the recipient
    this.emitNotificationToUser(savedNotification);
    
    return savedNotification;
  }

  /**
   * Find a notification by ID
   * @param id - The notification ID to find
   * @returns The notification or null if not found
   */
  async findOne(id: string): Promise<Notification | null> {
    return this.notificationsRepository.findOne({ where: { id } });
  }

  /**
   * Send a notification to a user
   * @param userId - ID of the user to receive the notification
   * @param type - Type of notification
   * @param payload - Data payload to include with the notification
   * @returns The created notification
   */
  async sendNotification(
    userId: string, 
    type: NotificationType, 
    payload: Record<string, any>,
  ): Promise<Notification> {
    console.log('[NotificationsService] Received payload in sendNotification:', payload);
    const dataPayload = { ...payload };
    const senderUserId = dataPayload.senderUserId;
    delete dataPayload.senderUserId;

    const createNotificationDto: CreateNotificationDto = {
      recipientUserId: userId,
      type,
      data: dataPayload,
      senderUserId,
    };

    console.log('[NotificationsService] DTO passed to createNotification:', createNotificationDto);
    return this.createNotification(createNotificationDto);
  }

  /**
   * Mark a notification as read
   * @param id - Notification ID
   * @returns The updated notification
   */
  async markAsRead(id: string): Promise<Notification> {
    const notification = await this.notificationsRepository.findOne({ where: { id } });
    
    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    notification.status = NotificationStatus.READ;
    return this.notificationsRepository.save(notification);
  }

  /**
   * Mark a notification as processed (after an action has been taken)
   * @param id - Notification ID
   * @returns The updated notification
   */
  async markAsProcessed(id: string): Promise<Notification> {
    const notification = await this.notificationsRepository.findOne({ where: { id } });
    
    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    notification.status = NotificationStatus.PROCESSED;
    return this.notificationsRepository.save(notification);
  }

  /**
   * Mark all notifications for a user as read
   * @param userId - User ID
   * @returns Number of affected notifications
   */
  async markAllAsRead(userId: string): Promise<{ affected: number }> {
    const result = await this.notificationsRepository.update(
      { recipientUserId: userId, status: NotificationStatus.UNREAD },
      { status: NotificationStatus.READ }
    );

    return { affected: result.affected || 0 };
  }

  /**
   * Get notifications for a specific user with optional filtering
   * @param userId - User ID
   * @param queryParams - Optional filtering parameters
   * @returns Array of notifications and total count
   */
  async getNotificationsForUser(
    userId: string, 
    queryParams: NotificationQueryDto,
  ): Promise<{ notifications: Notification[]; total: number }> {
    const { status, type, limit = 20, offset = 0 } = queryParams;
    
    const queryBuilder = this.notificationsRepository
      .createQueryBuilder('notification')
      .where('notification.recipient_user_id = :userId', { userId })
      .orderBy('notification.created_at', 'DESC')
      .take(limit)
      .skip(offset);

    if (status) {
      queryBuilder.andWhere('notification.status = :status', { status });
    }

    if (type) {
      queryBuilder.andWhere('notification.type = :type', { type });
    }

    const [notifications, total] = await queryBuilder.getManyAndCount();

    return { notifications, total };
  }

  /**
   * Get notifications for a user with optional filters
   * @param userId - ID of the user to get notifications for
   * @param options - Optional filters and pagination
   * @returns The list of notifications and total count
   */
  async getNotifications(
    userId: string,
    options?: { status?: NotificationStatus; limit?: number; offset?: number },
  ): Promise<{ notifications: Notification[]; total: number }> {
    // Prepare query parameters using existing DTO
    const queryParams: NotificationQueryDto = {
      status: options?.status,
      limit: options?.limit || 20,
      offset: options?.offset || 0,
    };

    // Use the existing getNotificationsForUser method
    return this.getNotificationsForUser(userId, queryParams);
  }

  /**
   * Get the count of unread notifications for a user
   * @param userId - User ID
   * @returns Number of unread notifications
   */
  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.notificationsRepository.count({
      where: {
        recipientUserId: userId,
        status: NotificationStatus.UNREAD,
      },
    });

    return { count };
  }

  /**
   * Delete a notification by ID
   * @param id - Notification ID
   * @returns Success message
   */
  async deleteNotification(id: string): Promise<{ success: boolean }> {
    const result = await this.notificationsRepository.delete(id);
    
    if (result.affected === 0) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    return { success: true };
  }

  /**
   * Emit a notification to a user via WebSocket
   * @param notification - The notification entity to emit
   * @returns Whether the emission was successful
   */
  private emitNotificationToUser(notification: Notification): boolean {
    try {
      // Create a user-friendly message based on notification type
      const message = this.getNotificationMessage(notification);
      
      // Create the event payload
      const eventPayload: NotificationEventDto = {
        id: notification.id,
        type: notification.type,
        message,
        data: notification.data,
        timestamp: notification.createdAt,
        senderUserId: notification.senderUserId || undefined,
      };
      
      // Emit to the user's room
      return this.notificationsGateway.emitToUser(
        notification.recipientUserId, 
        'new_notification', 
        eventPayload
      );
    } catch (error) {
      console.error(`Failed to emit notification: ${error.message}`);
      return false;
    }
  }

  /**
   * Generate a user-friendly message based on notification type
   * @param notification - The notification entity
   * @returns A user-friendly message
   */
  private getNotificationMessage(notification: Notification): string {
    switch (notification.type) {
      case NotificationType.FRIEND_REQUEST:
        return 'You have received a new friend request';
      case NotificationType.GAME_INVITE:
        return 'You have been invited to a game';
      case NotificationType.TOURNAMENT_ALERT:
        return 'A tournament you are registered for is starting soon';
      case NotificationType.CLUB_ROLE_UPDATE:
        return 'Your role in a club has been updated';
      case NotificationType.GAME_RESULT:
        return 'One of your games has ended';
      case NotificationType.MATCH_READY:
        return 'Your match is ready to begin';
      case NotificationType.SYSTEM_ALERT:
        return 'System notification';
      default:
        return 'You have a new notification';
    }
  }
} 