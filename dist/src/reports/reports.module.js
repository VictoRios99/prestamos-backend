"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const reports_controller_1 = require("./reports.controller");
const excel_export_service_1 = require("./excel-export.service");
const loan_entity_1 = require("../loans/entities/loan.entity");
const payment_entity_1 = require("../payments/entities/payment.entity");
const loans_service_1 = require("../loans/loans.service");
const payments_service_1 = require("../payments/payments.service");
const monthly_payment_entity_1 = require("../loans/entities/monthly-payment.entity");
const cash_movements_service_1 = require("../cash-movements/cash-movements.service");
const cash_movement_entity_1 = require("../cash-movements/entities/cash-movement.entity");
const roles_guard_1 = require("../auth/guards/roles.guard");
let ReportsModule = class ReportsModule {
};
exports.ReportsModule = ReportsModule;
exports.ReportsModule = ReportsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([loan_entity_1.Loan, payment_entity_1.Payment, monthly_payment_entity_1.MonthlyPayment, cash_movement_entity_1.CashMovement]),
        ],
        controllers: [reports_controller_1.ReportsController],
        providers: [
            excel_export_service_1.ExcelExportService,
            loans_service_1.LoansService,
            payments_service_1.PaymentsService,
            cash_movements_service_1.CashMovementsService,
            roles_guard_1.RolesGuard,
        ],
        exports: [excel_export_service_1.ExcelExportService],
    })
], ReportsModule);
//# sourceMappingURL=reports.module.js.map