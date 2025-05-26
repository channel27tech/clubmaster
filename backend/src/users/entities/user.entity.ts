import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true, unique: true })
  firebaseUid: string;

  @Column({ nullable: true })
  displayName: string;

  @Column({ unique: true, nullable: true })
  email: string;

  @Column({ nullable: true })
  photoURL: string;

  @Column({ default: false })
  isAnonymous: boolean;

  @Column({ default: 1500 })
  rating: number;

  @Column({ nullable: true })
  phoneNumber: string;

  @Column({ default: 0 })
  gamesPlayed: number;

  @Column({ default: 0 })
  gamesWon: number;

  @Column({ default: 0 })
  gamesLost: number;

  @Column({ default: 0 })
  gamesDraw: number;

  @Column({ nullable: true })
  location?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 