import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLoanTypeToLoan1755637581120 implements MigrationInterface {
  name = 'AddLoanTypeToLoan1755637581120';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loans" ADD "loan_type" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "loans" DROP COLUMN "loan_type"`);
  }
}
