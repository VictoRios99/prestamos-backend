import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLateInterestToPayments1760207496040 implements MigrationInterface {
    name = 'AddLateInterestToPayments1760207496040'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" ADD "late_interest" numeric(10,4) NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "late_interest"`);
    }

}
