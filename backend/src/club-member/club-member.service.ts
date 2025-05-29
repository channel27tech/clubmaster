import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClubMember } from './club-member.entity';
import { Club } from '../club/club.entity';
import { JoinClubDto } from './dto/join-club.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class ClubMemberService {
  constructor(
    @InjectRepository(ClubMember)
    private clubMemberRepository: Repository<ClubMember>,
    @InjectRepository(Club)
    private clubRepository: Repository<Club>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
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
      throw new BadRequestException('Invite required to join this club');
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
    return this.clubMemberRepository.save(member);
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
} 