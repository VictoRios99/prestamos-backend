"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonthlyPayment = void 0;
const typeorm_1 = require("typeorm");
const loan_entity_1 = require("./loan.entity");
let MonthlyPayment = class MonthlyPayment {
    id;
    loan;
    dueDate;
    expectedAmount;
    paidAmount;
    interestPaid;
    capitalPaid;
    isPaid;
    paymentDate;
    createdAt;
};
exports.MonthlyPayment = MonthlyPayment;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], MonthlyPayment.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => loan_entity_1.Loan, (loan) => loan.monthlyPayments, {
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'loan_id' }),
    __metadata("design:type", loan_entity_1.Loan)
], MonthlyPayment.prototype, "loan", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'due_date', type: 'date' }),
    __metadata("design:type", Date)
], MonthlyPayment.prototype, "dueDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'expected_amount', type: 'integer' }),
    __metadata("design:type", Number)
], MonthlyPayment.prototype, "expectedAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'paid_amount',
        type: 'integer',
        default: 0,
    }),
    __metadata("design:type", Number)
], MonthlyPayment.prototype, "paidAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'interest_paid',
        type: 'integer',
        default: 0,
    }),
    __metadata("design:type", Number)
], MonthlyPayment.prototype, "interestPaid", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'capital_paid',
        type: 'integer',
        default: 0,
    }),
    __metadata("design:type", Number)
], MonthlyPayment.prototype, "capitalPaid", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_paid', default: false }),
    __metadata("design:type", Boolean)
], MonthlyPayment.prototype, "isPaid", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'payment_date', type: 'date', nullable: true }),
    __metadata("design:type", Date)
], MonthlyPayment.prototype, "paymentDate", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], MonthlyPayment.prototype, "createdAt", void 0);
exports.MonthlyPayment = MonthlyPayment = __decorate([
    (0, typeorm_1.Entity)('monthly_payments')
], MonthlyPayment);
//# sourceMappingURL=monthly-payment.entity.js.map