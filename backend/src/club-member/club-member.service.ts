import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClubMember } from './club-member.entity';
import { Club } from '../club/club.entity';
import { JoinClubDto } from './dto/join-club.dto';

@Injectable()
export class ClubMemberService {
  constructor(
    @InjectRepository(ClubMember)
    private clubMemberRepository: Repository<ClubMember>,
    @InjectRepository(Club)
    private clubRepository: Repository<Club>,
  ) {}

  async joinClub(joinClubDto: JoinClubDto, userId: number) {
    // 1. Check if user already in a club
    const alreadyMember = await this.clubMemberRepository.findOne({ where: { userId } });
    if (alreadyMember) {
      throw new BadRequestException('User already in a club');
    }

    // 2. Get the club
    const club = await this.clubRepository.findOne({ where: { id: joinClubDto.clubId } });
    if (!club) {
      throw new BadRequestException('Club not found');
    }

    // 3. Check club type and eligibility
    if (club.type === 'public') {
      // allow
    } else if (club.type === 'private_by_invite') {
      throw new BadRequestException('Invite required to join this club');
    } else if (club.type === 'private_by_rating') {
      // Mock: user rating >= 1000
      const userRating = 1200; // Replace with real user rating
      if (userRating < 1000) {
        throw new BadRequestException('User rating too low to join this club');
      }
    } else if (club.type === 'private_by_location') {
      // Mock: user location matches club location
      const userLocation = 'India'; // Replace with real user location
      if (userLocation !== club.location) {
        throw new BadRequestException('User location does not match club location');
      }
    }

    // 4. Create ClubMember entry
    const member = this.clubMemberRepository.create({
      userId,
      clubId: club.id,
      role: 'member',
      joinedAt: new Date(),
      rating: 1200, // mock
      location: 'India', // mock
    });
    return this.clubMemberRepository.save(member);
  }

  async getMembersByClub(clubId: number) {
    return this.clubMemberRepository.find({ where: { clubId } });
  }
} 