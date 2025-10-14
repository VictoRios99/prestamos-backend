import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveCodeAndDocumentFromCustomer1755360097885
  implements MigrationInterface
{
  name = 'RemoveCodeAndDocumentFromCustomer1755360097885';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customers" DROP CONSTRAINT "UQ_f2eee14aa1fe3e956fe193c142f"`,
    );
    await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN "code"`);
    await queryRunner.query(
      `ALTER TABLE "customers" DROP CONSTRAINT "UQ_dffea8343d90688bccac70b63ad"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" DROP COLUMN "documentNumber"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customers" ADD "documentNumber" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD CONSTRAINT "UQ_dffea8343d90688bccac70b63ad" UNIQUE ("documentNumber")`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD "code" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD CONSTRAINT "UQ_f2eee14aa1fe3e956fe193c142f" UNIQUE ("code")`,
    );
  }
}
