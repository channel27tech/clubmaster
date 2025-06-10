import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationStatus } from './enums/notification-status.enum';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Notification } from './entities/notification.entity';
import { NotificationType } from './enums/notification-type.enum';

// Mock notification data
const mockNotification: Partial<Notification> = {
  id: '1',
  recipientUserId: 'user-123',
  type: NotificationType.SYSTEM_ALERT,
  data: { message: 'Test notification' },
  status: NotificationStatus.UNREAD,
  createdAt: new Date(),
};

// Mock user for authentication
const mockUser = { id: 'user-123', username: 'testuser' };

// Mock NotificationsService
const mockNotificationsService = {
  getNotificationsForUser: jest.fn(),
  getUnreadCount: jest.fn(),
  findOne: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
  deleteNotification: jest.fn(),
};

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
    service = module.get<NotificationsService>(NotificationsService);
    
    // Reset mock calls between tests
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getNotifications', () => {
    it('should return notifications for the authenticated user', async () => {
      const mockReq = { user: mockUser };
      const mockQuery = { status: NotificationStatus.UNREAD, limit: 10, offset: 0 };
      const mockResult = { 
        notifications: [mockNotification as Notification], 
        total: 1 
      };
      
      mockNotificationsService.getNotificationsForUser.mockResolvedValue(mockResult);
      
      const result = await controller.getNotifications(mockQuery, mockReq);
      
      expect(result).toEqual(mockResult);
      expect(mockNotificationsService.getNotificationsForUser).toHaveBeenCalledWith(
        mockUser.id,
        mockQuery
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread notification count for the authenticated user', async () => {
      const mockReq = { user: mockUser };
      const mockResult = { count: 5 };
      
      mockNotificationsService.getUnreadCount.mockResolvedValue(mockResult);
      
      const result = await controller.getUnreadCount(mockReq);
      
      expect(result).toEqual(mockResult);
      expect(mockNotificationsService.getUnreadCount).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read if it belongs to the user', async () => {
      const mockReq = { user: mockUser };
      const notificationId = '1';
      const updatedNotification = { 
        ...mockNotification, 
        status: NotificationStatus.READ 
      } as Notification;
      
      mockNotificationsService.findOne.mockResolvedValue(mockNotification);
      mockNotificationsService.markAsRead.mockResolvedValue(updatedNotification);
      
      const result = await controller.markAsRead(notificationId, mockReq);
      
      expect(result).toEqual(updatedNotification);
      expect(mockNotificationsService.findOne).toHaveBeenCalledWith(notificationId);
      expect(mockNotificationsService.markAsRead).toHaveBeenCalledWith(notificationId);
    });

    it('should throw NotFoundException if notification does not exist', async () => {
      const mockReq = { user: mockUser };
      const notificationId = 'nonexistent';
      
      mockNotificationsService.findOne.mockResolvedValue(null);
      
      await expect(controller.markAsRead(notificationId, mockReq)).rejects.toThrow(
        NotFoundException
      );
      
      expect(mockNotificationsService.markAsRead).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if notification belongs to another user', async () => {
      const mockReq = { user: { id: 'different-user' } };
      const notificationId = '1';
      
      mockNotificationsService.findOne.mockResolvedValue(mockNotification);
      
      await expect(controller.markAsRead(notificationId, mockReq)).rejects.toThrow(
        ForbiddenException
      );
      
      expect(mockNotificationsService.markAsRead).not.toHaveBeenCalled();
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read for the authenticated user', async () => {
      const mockReq = { user: mockUser };
      const mockResult = { affected: 5 };
      
      mockNotificationsService.markAllAsRead.mockResolvedValue(mockResult);
      
      const result = await controller.markAllAsRead(mockReq);
      
      expect(result).toEqual(mockResult);
      expect(mockNotificationsService.markAllAsRead).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification if it belongs to the user', async () => {
      const mockReq = { user: mockUser };
      const notificationId = '1';
      
      mockNotificationsService.findOne.mockResolvedValue(mockNotification);
      mockNotificationsService.deleteNotification.mockResolvedValue({ success: true });
      
      await controller.deleteNotification(notificationId, mockReq);
      
      expect(mockNotificationsService.findOne).toHaveBeenCalledWith(notificationId);
      expect(mockNotificationsService.deleteNotification).toHaveBeenCalledWith(notificationId);
    });

    it('should throw NotFoundException if notification does not exist', async () => {
      const mockReq = { user: mockUser };
      const notificationId = 'nonexistent';
      
      mockNotificationsService.findOne.mockResolvedValue(null);
      
      await expect(controller.deleteNotification(notificationId, mockReq)).rejects.toThrow(
        NotFoundException
      );
      
      expect(mockNotificationsService.deleteNotification).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if notification belongs to another user', async () => {
      const mockReq = { user: { id: 'different-user' } };
      const notificationId = '1';
      
      mockNotificationsService.findOne.mockResolvedValue(mockNotification);
      
      await expect(controller.deleteNotification(notificationId, mockReq)).rejects.toThrow(
        ForbiddenException
      );
      
      expect(mockNotificationsService.deleteNotification).not.toHaveBeenCalled();
    });
  });
}); 