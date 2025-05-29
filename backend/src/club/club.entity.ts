import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Club {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column()
  type: 'public' | 'private_by_invite' | 'private_by_rating' | 'private_by_location';

  @Column()
  location: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: '/uploads/default-logo.png' })
  logo: string;

  @Column({ default: 300 })
  points: number;

  @Column({ default: 50 })
  credits: number;

  @Column({ nullable: true })
  superAdminId: string;

  @Column({ type: 'int', default: 1000, nullable: true })
  ratingLimit: number;
} 