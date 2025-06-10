import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('club_invites')
export class ClubInvite {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  clubId: number;

  @Column({ unique: true })
  token: string;

  @Column()
  createdBy: string; // userId

  @Column({ nullable: true })
  usedBy: string; // userId

  @Column({ default: false })
  used: boolean;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
} 