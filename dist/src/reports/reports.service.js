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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const loan_entity_1 = require("../loans/entities/loan.entity");
const payment_entity_1 = require("../payments/entities/payment.entity");
const loans_service_1 = require("../loans/loans.service");
let ReportsService = class ReportsService {
    loansRepository;
    paymentsRepository;
    loansService;
    constructor(loansRepository, paymentsRepository, loansService) {
        this.loansRepository = loansRepository;
        this.paymentsRepository = paymentsRepository;
        this.loansService = loansService;
    }
    async getDashboardSummary() {
        return this.loansService.getDashboardStats();
    }
    async getMonthlyInterestReport(year) {
        const payments = await this.paymentsRepository.find({
            where: {
                paymentDate: (0, typeorm_2.Between)(new Date(year, 0, 1), new Date(year, 11, 31)),
            },
            relations: ['loan'],
        });
        const monthlyData = Array(12)
            .fill(0)
            .map(() => ({
            interest: 0,
            capital: 0,
            total: 0,
        }));
        return monthlyData.map((data, index) => ({
            month: index + 1,
            monthName: new Date(year, index).toLocaleString('es', { month: 'long' }),
            ...data,
        }));
    }
    async getPaymentsByDateRange(startDate, endDate) {
        return this.paymentsRepository.find({
            where: {
                paymentDate: (0, typeorm_2.Between)(startDate, endDate),
            },
            relations: ['loan', 'loan.customer'],
            order: { paymentDate: 'DESC' },
        });
    }
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(loan_entity_1.Loan)),
    __param(1, (0, typeorm_1.InjectRepository)(payment_entity_1.Payment)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        loans_service_1.LoansService])
], ReportsService);
//# sourceMappingURL=reports.service.js.map