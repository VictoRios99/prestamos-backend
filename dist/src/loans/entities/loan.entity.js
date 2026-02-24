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
exports.Loan = exports.LoanStatus = void 0;
const typeorm_1 = require("typeorm");
const customer_entity_1 = require("../../customers/entities/customer.entity");
const user_entity_1 = require("../../users/entities/user.entity");
const payment_entity_1 = require("../../payments/entities/payment.entity");
const monthly_payment_entity_1 = require("./monthly-payment.entity");
var LoanStatus;
(function (LoanStatus) {
    LoanStatus["ACTIVE"] = "ACTIVE";
    LoanStatus["PAID"] = "PAID";
    LoanStatus["OVERDUE"] = "OVERDUE";
    LoanStatus["CANCELLED"] = "CANCELLED";
})(LoanStatus || (exports.LoanStatus = LoanStatus = {}));
let Loan = class Loan {
    id;
    customer;
    loanDate;
    amount;
    currentBalance;
    totalInterestPaid;
    totalCapitalPaid;
    monthlyInterestRate;
    term;
    modality;
    loanType;
    status;
    displayId;
    notes;
    monthsPaid;
    lastPaymentDate;
    createdBy;
    payments;
    monthlyPayments;
    createdAt;
    updatedAt;
    interestRate;
    interestAmount;
    totalAmount;
    paymentFrequency;
    termMonths;
};
exports.Loan = Loan;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Loan.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => customer_entity_1.Customer, (customer) => customer.loans),
    (0, typeorm_1.JoinColumn)({ name: 'customer_id' }),
    __metadata("design:type", customer_entity_1.Customer)
], Loan.prototype, "customer", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'loan_date', type: 'date' }),
    __metadata("design:type", Date)
], Loan.prototype, "loanDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer' }),
    __metadata("design:type", Number)
], Loan.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'current_balance',
        type: 'integer',
        nullable: true,
    }),
    __metadata("design:type", Number)
], Loan.prototype, "currentBalance", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'total_interest_paid',
        type: 'integer',
        default: 0,
    }),
    __metadata("design:type", Number)
], Loan.prototype, "totalInterestPaid", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'total_capital_paid',
        type: 'integer',
        default: 0,
    }),
    __metadata("design:type", Number)
], Loan.prototype, "totalCapitalPaid", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'monthly_interest_rate',
        type: 'decimal',
        precision: 5,
        scale: 2,
    }),
    __metadata("design:type", String)
], Loan.prototype, "monthlyInterestRate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'term', type: 'integer', nullable: true }),
    __metadata("design:type", Number)
], Loan.prototype, "term", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Loan.prototype, "modality", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'loan_type', nullable: true }),
    __metadata("design:type", String)
], Loan.prototype, "loanType", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: LoanStatus,
        default: LoanStatus.ACTIVE,
    }),
    __metadata("design:type", String)
], Loan.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'display_id', nullable: true }),
    __metadata("design:type", String)
], Loan.prototype, "displayId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'text' }),
    __metadata("design:type", String)
], Loan.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'months_paid', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], Loan.prototype, "monthsPaid", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_payment_date', type: 'date', nullable: true }),
    __metadata("design:type", Date)
], Loan.prototype, "lastPaymentDate", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User),
    (0, typeorm_1.JoinColumn)({ name: 'created_by' }),
    __metadata("design:type", user_entity_1.User)
], Loan.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => payment_entity_1.Payment, (payment) => payment.loan),
    __metadata("design:type", Array)
], Loan.prototype, "payments", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => monthly_payment_entity_1.MonthlyPayment, (monthlyPayment) => monthlyPayment.loan),
    __metadata("design:type", Array)
], Loan.prototype, "monthlyPayments", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Loan.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Loan.prototype, "updatedAt", void 0);
exports.Loan = Loan = __decorate([
    (0, typeorm_1.Entity)('loans')
], Loan);
//# sourceMappingURL=loan.entity.js.map