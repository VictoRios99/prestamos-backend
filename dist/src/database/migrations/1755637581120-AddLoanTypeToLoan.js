"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddLoanTypeToLoan1755637581120 = void 0;
class AddLoanTypeToLoan1755637581120 {
    name = 'AddLoanTypeToLoan1755637581120';
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "loans" ADD "loan_type" character varying`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "loans" DROP COLUMN "loan_type"`);
    }
}
exports.AddLoanTypeToLoan1755637581120 = AddLoanTypeToLoan1755637581120;
//# sourceMappingURL=1755637581120-AddLoanTypeToLoan.js.map