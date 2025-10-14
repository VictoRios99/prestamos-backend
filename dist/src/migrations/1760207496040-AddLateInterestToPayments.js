"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddLateInterestToPayments1760207496040 = void 0;
class AddLateInterestToPayments1760207496040 {
    name = 'AddLateInterestToPayments1760207496040';
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "payments" ADD "late_interest" numeric(10,4) NOT NULL DEFAULT '0'`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "late_interest"`);
    }
}
exports.AddLateInterestToPayments1760207496040 = AddLateInterestToPayments1760207496040;
//# sourceMappingURL=1760207496040-AddLateInterestToPayments.js.map