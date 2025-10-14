"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const payments_service_1 = require("./payments.service");
const payments_controller_1 = require("./payments.controller");
const payment_entity_1 = require("./entities/payment.entity");
const loan_entity_1 = require("../loans/entities/loan.entity");
const monthly_payment_entity_1 = require("../loans/entities/monthly-payment.entity");
const cash_movements_module_1 = require("../cash-movements/cash-movements.module");
const loans_module_1 = require("../loans/loans.module");
const is_after_loan_date_validator_1 = require("../common/validators/is-after-loan-date.validator");
let PaymentsModule = class PaymentsModule {
};
exports.PaymentsModule = PaymentsModule;
exports.PaymentsModule = PaymentsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([payment_entity_1.Payment, loan_entity_1.Loan, monthly_payment_entity_1.MonthlyPayment]),
            cash_movements_module_1.CashMovementsModule,
            loans_module_1.LoansModule,
        ],
        controllers: [payments_controller_1.PaymentsController],
        providers: [payments_service_1.PaymentsService, is_after_loan_date_validator_1.IsAfterLoanDateConstraint],
        exports: [payments_service_1.PaymentsService],
    })
], PaymentsModule);
//# sourceMappingURL=payments.module.js.map