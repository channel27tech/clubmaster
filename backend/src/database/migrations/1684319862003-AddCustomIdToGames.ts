import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCustomIdToGames1684319862003 implements MigrationInterface {
    name = 'AddCustomIdToGames1684319862003'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add customId column to games table
        await queryRunner.query(`ALTER TABLE "games" ADD "customId" character varying`);
        
        // Create index on customId for faster lookups
        await queryRunner.query(`CREATE INDEX "IDX_games_customId" ON "games" ("customId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the index first
        await queryRunner.query(`DROP INDEX "IDX_games_customId"`);
        
        // Remove the customId column
        await queryRunner.query(`ALTER TABLE "games" DROP COLUMN "customId"`);
    }
}
