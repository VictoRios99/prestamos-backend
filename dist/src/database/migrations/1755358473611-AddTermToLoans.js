"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddTermToLoans1755358473611 = void 0;
class AddTermToLoans1755358473611 {
    name = 'AddTermToLoans1755358473611';
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "loans" ADD "term" integer`);
        await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "amount" TYPE numeric(10,4)`);
        await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "interest_paid" TYPE numeric(10,4)`);
        await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "capital_paid" TYPE numeric(10,4)`);
        await queryRunner.query(`ALTER TABLE "monthly_payments" ALTER COLUMN "expected_amount" TYPE numeric(10,4)`);
        await queryRunner.query(`ALTER TABLE "monthly_payments" ALTER COLUMN "paid_amount" TYPE numeric(10,4)`);
        await queryRunner.query(`ALTER TABLE "monthly_payments" ALTER COLUMN "interest_paid" TYPE numeric(10,4)`);
        await queryRunner.query(`ALTER TABLE "monthly_payments" ALTER COLUMN "capital_paid" TYPE numeric(10,4)`);
        await queryRunner.query(`ALTER TABLE "loans" ALTER COLUMN "amount" TYPE numeric(10,4)`);
        await queryRunner.query(`ALTER TABLE "loans" ALTER COLUMN "current_balance" TYPE numeric(10,4)`);
        await queryRunner.query(`ALTER TABLE "loans" ALTER COLUMN "total_interest_paid" TYPE numeric(10,4)`);
        await queryRunner.query(`ALTER TABLE "loans" ALTER COLUMN "total_capital_paid" TYPE numeric(10,4)`);
        await queryRunner.query(`ALTER TABLE "loans" ALTER COLUMN "monthly_interest_rate" TYPE numeric(5,2)`);
        await queryRunner.query(`ALTER TABLE "loans" ALTER COLUMN "monthly_interest_rate" DROP DEFAULT`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "loans" ALTER COLUMN "monthly_interest_rate" SET DEFAULT '5'`);
        await queryRunner.query(`ALTER TABLE "loans" ALTER COLUMN "monthly_interest_rate" TYPE numeric(5,4)`);
        await queryRunner.query(`ALTER TABLE "loans" ALTER COLUMN "total_capital_paid" TYPE numeric(12,4)`);
        await queryRunner.query(`ALTER TABLE "loans" ALTER COLUMN "total_interest_paid" TYPE numeric(12,4)`);
        await queryRunner.query(`ALTER TABLE "loans" ALTER COLUMN "current_balance" TYPE numeric(12,4)`);
        await queryRunner.query(`ALTER TABLE "loans" ALTER COLUMN "amount" TYPE numeric(12,4)`);
        await queryRunner.query(`ALTER TABLE "monthly_payments" ALTER COLUMN "capital_paid" TYPE numeric(12,2)`);
        await queryRunner.query(`ALTER TABLE "monthly_payments" ALTER COLUMN "interest_paid" TYPE numeric(12,2)`);
        await queryRunner.query(`ALTER TABLE "monthly_payments" ALTER COLUMN "paid_amount" TYPE numeric(12,2)`);
        await queryRunner.query(`ALTER TABLE "monthly_payments" ALTER COLUMN "expected_amount" TYPE numeric(12,2)`);
        await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "capital_paid" TYPE numeric(12,2)`);
        await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "interest_paid" TYPE numeric(12,2)`);
        await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "amount" TYPE numeric(12,2)`);
        await queryRunner.query(`ALTER TABLE "loans" DROP COLUMN "term"`);
    }
}
exports.AddTermToLoans1755358473611 = AddTermToLoans1755358473611;
//# sourceMappingURL=1755358473611-AddTermToLoans.js.map