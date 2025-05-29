import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRatingLimitToClub1684320000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE club ADD COLUMN IF NOT EXISTS "ratingLimit" integer DEFAULT 1000
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE club DROP COLUMN IF EXISTS "ratingLimit"
        `);
    }
} 