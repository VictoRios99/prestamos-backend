"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemoveCodeAndDocumentFromCustomer1755360097885 = void 0;
class RemoveCodeAndDocumentFromCustomer1755360097885 {
    name = 'RemoveCodeAndDocumentFromCustomer1755360097885';
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "customers" DROP CONSTRAINT "UQ_f2eee14aa1fe3e956fe193c142f"`);
        await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN "code"`);
        await queryRunner.query(`ALTER TABLE "customers" DROP CONSTRAINT "UQ_dffea8343d90688bccac70b63ad"`);
        await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN "documentNumber"`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "customers" ADD "documentNumber" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "customers" ADD CONSTRAINT "UQ_dffea8343d90688bccac70b63ad" UNIQUE ("documentNumber")`);
        await queryRunner.query(`ALTER TABLE "customers" ADD "code" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "customers" ADD CONSTRAINT "UQ_f2eee14aa1fe3e956fe193c142f" UNIQUE ("code")`);
    }
}
exports.RemoveCodeAndDocumentFromCustomer1755360097885 = RemoveCodeAndDocumentFromCustomer1755360097885;
//# sourceMappingURL=1755360097885-RemoveCodeAndDocumentFromCustomer.js.map