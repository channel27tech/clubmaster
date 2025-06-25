import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Request, HttpStatus, HttpCode, NotFoundException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
// import { FirebaseAuthGuard } from '../firebase/firebase-auth.guard';
import { Notification } from './entities/notification.entity';
import { UsersService } from '../users/users.service';

@Controller('notifications')
@UseGuards(FirebaseAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Get notifications for the authenticated user with optional filtering and pagination
   */
  @Get()
  async getNotifications(
    @Query() query: NotificationQueryDto,
    @Request() req,
  ): Promise<{ notifications: Notification[]; total: number }> {
    console.log('NotificationsController: req.user:', req.user);
    const firebaseUid = req.user.uid;
    const user = await this.usersService.findByFirebaseUid(firebaseUid);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    console.log('NotificationsController: internal user id:', user.id);
    return this.notificationsService.getNotificationsForUser(user.id, query);
  }

  /**
   * Get the count of unread notifications for the authenticated user
   */
  @Get('unread-count')
  async getUnreadCount(
    @Request() req,
  ): Promise<{ count: number }> {
    const userId = req.user.uid;
    return this.notificationsService.getUnreadCount(userId);
  }

  /**
   * Mark a specific notification as read
   * Validates that the notification belongs to the authenticated user
   */
  @Patch(':id/read')
  async markAsRead(
    @Param('id') id: string,
    @Request() req,
  ): Promise<Notification> {
    const userId = req.user.uid;
    
    // Get the notification first to verify ownership
    const notification = await this.notificationsService.findOne(id);
    
    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }
    
    // Verify the notification belongs to the requesting user
    if (notification.recipientUserId !== userId) {
      throw new ForbiddenException('You do not have permission to access this notification');
    }
    
    return this.notificationsService.markAsRead(id);
  }

  /**
   * Mark all notifications for the authenticated user as read
   */
  @Patch('read-all')
  async markAllAsRead(
    @Request() req,
  ): Promise<{ affected: number }> {
    const userId = req.user.uid;
    return this.notificationsService.markAllAsRead(userId);
  }

  /**
   * Delete a notification
   * Validates that the notification belongs to the authenticated user
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNotification(
    @Param('id') id: string,
    @Request() req,
  ): Promise<void> {
    const userId = req.user.uid;
    
    // Get the notification first to verify ownership
    const notification = await this.notificationsService.findOne(id);
    
    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }
    
    // Verify the notification belongs to the requesting user
    if (notification.recipientUserId !== userId) {
      throw new ForbiddenException('You do not have permission to access this notification');
    }
    
    await this.notificationsService.deleteNotification(id);
  }
} 