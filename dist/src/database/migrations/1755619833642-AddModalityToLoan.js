"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddModalityToLoan1755619833642 = void 0;
class AddModalityToLoan1755619833642 {
    name = 'AddModalityToLoan1755619833642';
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "loans" ADD "modality" character varying`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "loans" DROP COLUMN "modality"`);
    }
}
exports.AddModalityToLoan1755619833642 = AddModalityToLoan1755619833642;
//# sourceMappingURL=1755619833642-AddModalityToLoan.js.map