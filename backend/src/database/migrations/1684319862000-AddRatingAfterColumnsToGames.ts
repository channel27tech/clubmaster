import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRatingAfterColumnsToGames1684319862000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE games 
            ADD COLUMN IF NOT EXISTS "whitePlayerRatingAfter" integer,
            ADD COLUMN IF NOT EXISTS "blackPlayerRatingAfter" integer
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE games 
            DROP COLUMN IF EXISTS "whitePlayerRatingAfter",
            DROP COLUMN IF EXISTS "blackPlayerRatingAfter"
        `);
    }
} 