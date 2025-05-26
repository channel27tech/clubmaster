import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/entities/user.entity';

@Entity()
export class ClubMember {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  userId: string;

  @Column()
  clubId: number;

  @Column({ default: 'member' })
  role: 'member' | 'admin' | 'super_admin';

  @CreateDateColumn()
  joinedAt: Date;

  @Column({ nullable: true })
  rating: number;

  @Column({ nullable: true })
  location: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;
} 