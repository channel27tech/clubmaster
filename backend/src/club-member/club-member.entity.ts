import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity()
export class ClubMember {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

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
} 