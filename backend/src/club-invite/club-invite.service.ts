import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClubInvite } from './club-invite.entity';
import { nanoid } from 'nanoid';

@Injectable()
export class ClubInviteService {
  constructor(
    @InjectRepository(ClubInvite)
    private inviteRepo: Repository<ClubInvite>,
  ) {}

  async createInvite(clubId: number, createdBy: string) {
    console.log('createInvite called with:', { clubId, createdBy });
    const token = nanoid(16);
    const invite = this.inviteRepo.create({ clubId, token, createdBy });
    console.log('Saving invite:', invite);
    return this.inviteRepo.save(invite);
  }

  async validateInvite(token: string, clubId: number) {
    const invite = await this.inviteRepo.findOne({ where: { token, clubId, used: false } });
    if (!invite) throw new BadRequestException('Invalid or expired invite');
    return invite;
  }

  async markInviteUsed(token: string, usedBy: string) {
    const invite = await this.inviteRepo.findOne({ where: { token } });
    if (!invite) {
      throw new BadRequestException('Invite not found');
    }
    invite.used = true;
    invite.usedBy = usedBy;
    await this.inviteRepo.save(invite);
  }
} 