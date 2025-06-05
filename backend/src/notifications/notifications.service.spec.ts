import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, ObjectLiteral } from 'typeorm';
import { NotificationsService } from './notifications.service';
import { Notification } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationType } from './enums/notification-type.enum';
import { NotificationStatus } from './enums/notification-status.enum';
import { NotificationsGateway } from './notifications.gateway';

type MockRepository<T extends ObjectLiteral = any> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const createMockRepository = <T extends ObjectLiteral>(): MockRepository<T> => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  })),
});

// Mock for NotificationsGateway
const mockNotificationsGateway = {
  emitToUser: jest.fn().mockReturnValue(true),
  getUserConnectionCount: jest.fn().mockReturnValue(1),
};

describe('NotificationsService', () => {
  let service: NotificationsService;
  let repository: MockRepository<Notification>;
  let gateway: NotificationsGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: createMockRepository(),
        },
        {
          provide: NotificationsGateway,
          useValue: mockNotificationsGateway,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    repository = module.get<MockRepository<Notification>>(getRepositoryToken(Notification));
    gateway = module.get<NotificationsGateway>(NotificationsGateway);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createNotification', () => {
    it('should create a new notification and emit to user', async () => {
      const dto: CreateNotificationDto = {
        recipientUserId: 'user-123',
        type: NotificationType.FRIEND_REQUEST,
        data: { fromUser: 'user-456' },
      };

      const expectedNotification = {
        id: 'notif-1',
        ...dto,
        senderUserId: null,
        status: NotificationStatus.UNREAD,
        createdAt: new Date(),
      };

      repository.create!.mockReturnValue(expectedNotification);
      repository.save!.mockResolvedValue(expectedNotification);

      const result = await service.createNotification(dto);
      
      expect(result).toEqual(expectedNotification);
      expect(repository.create).toHaveBeenCalledWith({
        recipientUserId: dto.recipientUserId,
        senderUserId: null,
        type: dto.type,
        data: dto.data,
        status: NotificationStatus.UNREAD,
      });
      expect(repository.save).toHaveBeenCalledWith(expectedNotification);
      
      // Verify that the gateway's emitToUser method was called
      expect(gateway.emitToUser).toHaveBeenCalledWith(
        dto.recipientUserId,
        'new_notification',
        expect.objectContaining({
          id: expectedNotification.id,
          type: expectedNotification.type,
          data: expectedNotification.data,
        })
      );
    });
  });

  describe('sendNotification', () => {
    it('should send a notification with payload data', async () => {
      const userId = 'user-123';
      const type = NotificationType.GAME_INVITE;
      const payload = { 
        gameId: 'game-456',
        timeControl: '5+0',
        senderUserId: 'user-789'
      };

      const expectedDto: CreateNotificationDto = {
        recipientUserId: userId,
        senderUserId: 'user-789',
        type,
        data: { 
          gameId: 'game-456',
          timeControl: '5+0'
        },
      };

      const expectedNotification = {
        id: 'notif-2',
        recipientUserId: userId,
        senderUserId: 'user-789',
        type,
        data: { 
          gameId: 'game-456',
          timeControl: '5+0'
        },
        status: NotificationStatus.UNREAD,
        createdAt: new Date(),
      };

      // Since sendNotification uses createNotification internally
      // we need to mock that entire process
      repository.create!.mockReturnValue(expectedNotification);
      repository.save!.mockResolvedValue(expectedNotification);

      const result = await service.sendNotification(userId, type, payload);
      
      expect(result).toEqual(expectedNotification);
      
      // Check that create was called with correct parameters
      expect(repository.create).toHaveBeenCalledWith({
        recipientUserId: expectedDto.recipientUserId,
        senderUserId: expectedDto.senderUserId,
        type: expectedDto.type,
        data: expectedDto.data,
        status: NotificationStatus.UNREAD,
      });
      
      expect(repository.save).toHaveBeenCalledWith(expectedNotification);
      
      // Verify that the gateway's emitToUser method was called
      expect(gateway.emitToUser).toHaveBeenCalledWith(
        userId,
        'new_notification',
        expect.objectContaining({
          id: expectedNotification.id,
          type: expectedNotification.type,
          data: expectedNotification.data,
        })
      );
    });

    it('should handle payload without senderUserId', async () => {
      const userId = 'user-123';
      const type = NotificationType.SYSTEM_ALERT;
      const payload = { 
        message: 'System maintenance in 1 hour',
        duration: '30 minutes'
      };

      const expectedNotification = {
        id: 'notif-3',
        recipientUserId: userId,
        senderUserId: null,
        type,
        data: payload,
        status: NotificationStatus.UNREAD,
        createdAt: new Date(),
      };

      repository.create!.mockReturnValue(expectedNotification);
      repository.save!.mockResolvedValue(expectedNotification);

      const result = await service.sendNotification(userId, type, payload);
      
      expect(result).toEqual(expectedNotification);
      expect(repository.create).toHaveBeenCalledWith({
        recipientUserId: userId,
        senderUserId: null,
        type,
        data: payload,
        status: NotificationStatus.UNREAD,
      });
      
      // Verify that the gateway's emitToUser method was called
      expect(gateway.emitToUser).toHaveBeenCalledWith(
        userId,
        'new_notification',
        expect.objectContaining({
          id: expectedNotification.id,
          type: expectedNotification.type,
          data: expectedNotification.data,
        })
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      const id = 'notif-1';
      const notification = {
        id,
        recipientUserId: 'user-123',
        type: NotificationType.FRIEND_REQUEST,
        data: { fromUser: 'user-456' },
        status: NotificationStatus.UNREAD,
        createdAt: new Date(),
      };
      
      const updatedNotification = {
        ...notification,
        status: NotificationStatus.READ,
      };

      repository.findOne!.mockResolvedValue(notification);
      repository.save!.mockResolvedValue(updatedNotification);

      const result = await service.markAsRead(id);
      
      expect(result).toEqual(updatedNotification);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { id } });
      expect(repository.save).toHaveBeenCalledWith({
        ...notification,
        status: NotificationStatus.READ,
      });
    });

    it('should throw NotFoundException if notification not found', async () => {
      const id = 'non-existent-id';
      
      repository.findOne!.mockResolvedValue(null);

      await expect(service.markAsRead(id)).rejects.toThrow();
    });
  });

  describe('getNotifications', () => {
    it('should return notifications for a user with default options', async () => {
      const userId = 'user-123';
      const mockNotifications = [
        {
          id: 'notif-1',
          recipientUserId: userId,
          type: NotificationType.FRIEND_REQUEST,
          data: { fromUser: 'user-456' },
          status: NotificationStatus.UNREAD,
          createdAt: new Date(),
        }
      ];
      
      const mockQueryBuilder = repository.createQueryBuilder!();
      mockQueryBuilder.getManyAndCount.mockResolvedValue([mockNotifications, 1]);

      const result = await service.getNotifications(userId);
      
      expect(result).toEqual({ notifications: mockNotifications, total: 1 });
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'notification.recipient_user_id = :userId',
        { userId }
      );
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('notification.created_at', 'DESC');
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(20); // Default limit
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0); // Default offset
    });

    it('should apply status filter when provided', async () => {
      const userId = 'user-123';
      const options = { status: NotificationStatus.UNREAD };
      const mockNotifications = [
        {
          id: 'notif-1',
          recipientUserId: userId,
          type: NotificationType.FRIEND_REQUEST,
          data: { fromUser: 'user-456' },
          status: NotificationStatus.UNREAD,
          createdAt: new Date(),
        }
      ];
      
      const mockQueryBuilder = repository.createQueryBuilder!();
      mockQueryBuilder.getManyAndCount.mockResolvedValue([mockNotifications, 1]);

      const result = await service.getNotifications(userId, options);
      
      expect(result).toEqual({ notifications: mockNotifications, total: 1 });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'notification.status = :status',
        { status: NotificationStatus.UNREAD }
      );
    });

    it('should apply pagination when provided', async () => {
      const userId = 'user-123';
      const options = { limit: 5, offset: 10 };
      const mockNotifications = [
        {
          id: 'notif-11',
          recipientUserId: userId,
          type: NotificationType.FRIEND_REQUEST,
          data: { fromUser: 'user-456' },
          status: NotificationStatus.UNREAD,
          createdAt: new Date(),
        }
      ];
      
      const mockQueryBuilder = repository.createQueryBuilder!();
      mockQueryBuilder.getManyAndCount.mockResolvedValue([mockNotifications, 15]);

      const result = await service.getNotifications(userId, options);
      
      expect(result).toEqual({ notifications: mockNotifications, total: 15 });
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(5);
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10);
    });
  });

  // Tests for other methods...
}); 