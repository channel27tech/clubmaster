import { Injectable, BadRequestException, NotFoundException, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClubMember } from './club-member.entity';
import { Club } from '../club/club.entity';
import { JoinClubDto } from './dto/join-club.dto';
import { User } from '../users/entities/user.entity';
import { ClubInviteService } from '../club-invite/club-invite.service';
import { ClubNotificationHelper } from '../club/club-notification.helper';

@Injectable()
export class ClubMemberService {
  private readonly logger = new Logger(ClubMemberService.name);

  constructor(
    @InjectRepository(ClubMember)
    private clubMemberRepository: Repository<ClubMember>,
    @InjectRepository(Club)
    private clubRepository: Repository<Club>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private clubInviteService: ClubInviteService,
    private clubNotificationHelper: ClubNotificationHelper,
  ) {}

  async joinClub(joinClubDto: JoinClubDto, firebaseUid: string) {
    // 3. Get user details from the database
    const user = await this.userRepository.findOne({ where: { firebaseUid } });
    if (!user) {
      throw new NotFoundException(`User with Firebase UID ${firebaseUid} not found`);
    }

    // 1. Check if user already in a club
    const alreadyMember = await this.clubMemberRepository.findOne({ where: { userId: user.id } });
    if (alreadyMember) {
      throw new BadRequestException('User already in a club');
    }

    // 2. Get the club
    const club = await this.clubRepository.findOne({ where: { id: joinClubDto.clubId } });
    if (!club) {
      throw new BadRequestException('Club not found');
    }

    // 4. Check club type and eligibility
    if (club.type === 'public') {
      // allow
    } else if (club.type === 'private_by_invite') {
      if (!joinClubDto.inviteToken) {
        throw new BadRequestException('Invite required to join this club');
      }
      // Validate invite token
      const invite = await this.clubInviteService.validateInvite(joinClubDto.inviteToken, club.id);
      // Mark invite as used
      await this.clubInviteService.markInviteUsed(joinClubDto.inviteToken, user.id.toString());
    } else if (club.type === 'private_by_rating') {
      const limit = club.ratingLimit ?? 1000;
      if (user.rating < limit) {
        throw new BadRequestException(`User rating too low to join this club (minimum: ${limit})`);
      }
    } else if (club.type === 'private_by_location') {
      // Use actual user location
      if (!user.location) {
        throw new BadRequestException('User location not set');
      }
      if (user.location !== club.location) {
        throw new BadRequestException('User location does not match club location');
      }
    }

    // 5. Create ClubMember entry
    const member = this.clubMemberRepository.create({
      userId: user.id,
      clubId: club.id,
      role: 'member',
      joinedAt: new Date(),
      rating: user.rating,
      location: user.location || undefined,
    });
    const savedMember = await this.clubMemberRepository.save(member);

    // Send notification to all club admins
    try {
      // Get admin userIds
      const admins = await this.clubMemberRepository.find({
        where: { clubId: club.id, role: 'admin' },
      });
      
      const adminIds = admins.map(admin => admin.userId);
      
      if (adminIds.length > 0) {
        await this.clubNotificationHelper.sendMemberJoinedNotification(
          adminIds,
          user.id,
          user.displayName || 'New Member',
          club.id.toString(),
          club.name,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to send club member joined notifications: ${error.message}`);
      // Non-blocking - continue even if notifications fail
    }

    return savedMember;
  }

  async getMembersByClub(clubId: number) {
    // Join users table to get firebaseUid for each member
    const members = await this.clubMemberRepository
      .createQueryBuilder('clubMember')
      .leftJoinAndSelect('clubMember.user', 'user')
      .where('clubMember.clubId = :clubId', { clubId })
      .select([
        'clubMember.id',
        'clubMember.role',
        'clubMember.rating',
        'user.id',
        'user.displayName',
        'user.photoURL',
        'user.firebaseUid',
      ])
      .getMany();

    return members
      .filter(member => member.user)
      .map(member => ({
        id: member.user.id,
        firebaseUid: member.user.firebaseUid,
        displayName: member.user.displayName,
        photoURL: member.user.photoURL || '/images/default-avatar.svg',
        rating: member.rating,
        role: member.role,
      }));
  }

  // Add member to club
  async addMember(userId: string, clubId: string, role: string = 'member'): Promise<ClubMember> {
    try {
      // Convert clubId to number
      const clubIdNum = parseInt(clubId, 10);
      if (isNaN(clubIdNum)) {
        throw new BadRequestException('Invalid club ID');
      }

      // Check if the club exists
      const club = await this.clubRepository.findOne({ where: { id: clubIdNum } });
      if (!club) {
        throw new NotFoundException(`Club with ID ${clubId} not found`);
      }
      
      // Check if member is already in club
      const existingMembership = await this.clubMemberRepository.findOne({
        where: { userId, clubId: clubIdNum },
      });
      
      if (existingMembership) {
        throw new BadRequestException('User is already a member of this club');
      }
      
      // Validate role
      const validRole = role === 'member' || role === 'admin' || role === 'super_admin' 
        ? role as 'member' | 'admin' | 'super_admin'
        : 'member';
      
      // Create new club member
      const clubMember = this.clubMemberRepository.create({
        userId,
        clubId: clubIdNum,
        role: validRole,
      });
      
      const savedMember = await this.clubMemberRepository.save(clubMember);
      
      // Send notification to all club admins
      try {
        // Get admin userIds
        const admins = await this.clubMemberRepository.find({
          where: { clubId: clubIdNum, role: 'admin' },
        });
        
        const adminIds = admins.map(admin => admin.userId);
        
        if (adminIds.length > 0) {
          // Get the username of the new member
          // In a real app, you would fetch the username from your users service
          const memberUsername = 'New Member'; // Replace with actual username
          
          await this.clubNotificationHelper.sendMemberJoinedNotification(
            adminIds,
            userId,
            memberUsername,
            clubId,
            club.name,
          );
        }
      } catch (error) {
        this.logger.error(`Failed to send club member joined notifications: ${error.message}`);
        // Non-blocking - continue even if notifications fail
      }
      
      return savedMember;
    } catch (error) {
      this.logger.error(`Error adding member to club: ${error.message}`);
      throw error;
    }
  }
  
  // Remove member from club - This is for an admin kicking a member
  async removeMember(removerFirebaseUid: string, targetUserId: string, clubId: string): Promise<void> {
    const clubIdNum = parseInt(clubId, 10);
    if (isNaN(clubIdNum)) throw new BadRequestException('Invalid club ID');

    const club = await this.clubRepository.findOne({ where: { id: clubIdNum } });
    if (!club) throw new NotFoundException(`Club with ID ${clubId} not found`);

    const removerUser = await this.userRepository.findOne({ where: { firebaseUid: removerFirebaseUid } });
    if (!removerUser) throw new NotFoundException('Remover user not found');

    const removerMembership = await this.clubMemberRepository.findOne({
      where: { userId: removerUser.id, clubId: clubIdNum },
    });
    if (!removerMembership || !['admin', 'super_admin'].includes(removerMembership.role)) {
      throw new ForbiddenException('You do not have permission to remove members from this club.');
    }

    const targetMembership = await this.clubMemberRepository.findOne({
      where: { userId: targetUserId, clubId: clubIdNum },
    });
    if (!targetMembership) throw new NotFoundException('Target user is not a member of this club.');

    if (targetMembership.role === 'super_admin') {
      throw new ForbiddenException('Cannot remove the super admin.');
    }
    
    if (targetMembership.role === 'admin' && removerMembership.role !== 'super_admin') {
        throw new ForbiddenException('Admins can only be removed by a super admin.');
    }

    // Send notification to the removed member
    try {
        const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
        const logoUrl = club.logo && !club.logo.startsWith('http') ? `${baseUrl}${club.logo}` : club.logo;
        await this.clubNotificationHelper.sendMemberRemovedNotification(
            targetUserId,
            clubId,
            club.name,
            removerUser.id,
            removerUser.displayName || 'an admin',
            logoUrl
        );
    } catch (error) {
      this.logger.error(`Failed to send member removed notification: ${error.message}`);
    }

    await this.clubMemberRepository.remove(targetMembership);
  }

  // Update member role
  async updateMemberRole(adminUserId: string, targetUserId: string, clubId: string, newRole: string): Promise<ClubMember> {
    try {
      // Convert clubId to number
      const clubIdNum = parseInt(clubId, 10);
      if (isNaN(clubIdNum)) {
        throw new BadRequestException('Invalid club ID');
      }

      // Check if the club exists
      const club = await this.clubRepository.findOne({ where: { id: clubIdNum } });
      if (!club) {
        throw new NotFoundException(`Club with ID ${clubId} not found`);
      }
      
      // Check if target user is a member
      const membership = await this.clubMemberRepository.findOne({
        where: { userId: targetUserId, clubId: clubIdNum },
      });
      
      if (!membership) {
        throw new NotFoundException('User is not a member of this club');
      }
      
      // Validate role
      const validRole = newRole === 'member' || newRole === 'admin' || newRole === 'super_admin' 
        ? newRole as 'member' | 'admin' | 'super_admin'
        : 'member';

      // Update role
      membership.role = validRole;
      const updatedMember = await this.clubMemberRepository.save(membership);
      
      // Send notification to the target user
      try {
        await this.clubNotificationHelper.sendRoleUpdateNotification(
          targetUserId,
          adminUserId,
          clubId,
          club.name,
          validRole,
        );
      } catch (error) {
        this.logger.error(`Failed to send role update notification: ${error.message}`);
        // Non-blocking - continue even if notifications fail
      }
      
      return updatedMember;
    } catch (error) {
      this.logger.error(`Error updating member role: ${error.message}`);
      throw error;
    }
  }
  
  // Transfer super admin role
  async transferSuperAdmin(currentAdminId: string, newAdminId: string, clubId: string): Promise<void> {
    const clubIdNum = parseInt(clubId, 10);
    if (isNaN(clubIdNum)) {
      throw new BadRequestException('Invalid club ID');
    }
    const club = await this.clubRepository.findOne({ 
      where: { id: clubIdNum },
      select: ['id', 'name', 'logo'],
    });
    if (!club) {
      throw new NotFoundException(`Club with ID ${clubId} not found`);
    }
    const currentAdminMembership = await this.clubMemberRepository.findOne({
      where: { userId: currentAdminId, clubId: clubIdNum, role: 'super_admin' },
    });
    if (!currentAdminMembership) {
      throw new BadRequestException('You are not the super admin of this club');
    }
    const newAdminMembership = await this.clubMemberRepository.findOne({
      where: { userId: newAdminId, clubId: clubIdNum },
    });
    if (!newAdminMembership) {
      throw new NotFoundException('Target user is not a member of this club');
    }
    currentAdminMembership.role = 'member';
    newAdminMembership.role = 'super_admin';
    await this.clubMemberRepository.save([currentAdminMembership, newAdminMembership]);

    // Add console and logger messages
    console.log(`[SuperAdminTransfer] ClubID: ${clubId} | OldSuperAdmin: ${currentAdminId} -> NewSuperAdmin: ${newAdminId}`);
    this.logger.log(`Super admin role transferred in club ${clubId}: ${currentAdminId} -> ${newAdminId}`);

    // Send notification to the new super admin
    try {
      const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
      const logoUrl = club.logo && !club.logo.startsWith('http') ? `${baseUrl}${club.logo}` : club.logo;
      this.logger.debug(`[ClubMemberService] Club logo URL for notification: ${logoUrl}`);

      await this.clubNotificationHelper.sendSuperAdminTransferNotification(
        newAdminId,
        currentAdminId,
        club.name,
        logoUrl,
      );
    } catch (error) {
      this.logger.error(`Failed to send super admin transfer notification: ${error.message}`);
      // Non-blocking - continue even if notifications fail
    }
  }

  async removeMemberFromClub(clubId: string, userId: string): Promise<void> {
    // This method seems to be called without a remover context, so it's ambiguous.
    // For now, it's safer to assume this is a "leave" action until its usage is clarified.
    await this.leaveClub(userId, clubId);
  }

  async leaveClub(userFirebaseUid: string, clubId: string): Promise<void> {
    const clubIdNum = parseInt(clubId, 10);
    if (isNaN(clubIdNum)) throw new BadRequestException('Invalid club ID');

    const club = await this.clubRepository.findOne({ where: { id: clubIdNum } });
    if (!club) throw new NotFoundException('Club not found');
    
    const user = await this.userRepository.findOne({ where: { firebaseUid: userFirebaseUid } });
    if (!user) throw new NotFoundException('User not found');

    const member = await this.clubMemberRepository.findOne({
      where: { userId: user.id, clubId: clubIdNum }
    });
    if (!member) throw new NotFoundException('You are not a member of this club');
    
    if (member.role === 'super_admin') {
      throw new ForbiddenException(
        'As a super admin, you must transfer your role to another member before leaving the club'
      );
    }

    // Notify admins that a member has left
    try {
        const admins = await this.clubMemberRepository.find({
            where: { clubId: clubIdNum, role: 'super_admin' },
        });
        const adminIds = admins.map(admin => admin.userId);

        if (adminIds.length > 0) {
            await this.clubNotificationHelper.sendMemberLeftNotification(
                adminIds,
                user.id,
                user.displayName || 'A member',
                clubId,
                club.name,
                user.photoURL || '/images/avatars/default.jpg',
            );
        }
    } catch (error) {
        this.logger.error(`Failed to send member left notification: ${error.message}`);
    }

    // Remove the member
    await this.clubMemberRepository.remove(member);
  }
} 