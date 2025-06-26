import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBetChallengeIdToGames1750838006377 implements MigrationInterface {
    name = 'AddBetChallengeIdToGames1750838006377'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "games" ADD "betChallengeId" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "games" DROP COLUMN "betChallengeId"`);
    }

}
