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
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const loan_entity_1 = require("../loans/entities/loan.entity");
const payment_entity_1 = require("../payments/entities/payment.entity");
let DashboardService = class DashboardService {
    loansRepository;
    paymentsRepository;
    constructor(loansRepository, paymentsRepository) {
        this.loansRepository = loansRepository;
        this.paymentsRepository = paymentsRepository;
    }
    async getDashboardStats() {
        const loans = await this.loansRepository.find({
            relations: ['customer', 'payments', 'monthlyPayments'],
            order: { loanDate: 'DESC' },
        });
        let dineroRestado = 0;
        let capitalRecuperado = 0;
        let interesRecabado = 0;
        let cargosExtrasRecaudados = 0;
        let capitalEnTransito = 0;
        let prestamosVencidos = 0;
        let montoVencido = 0;
        let totalRecaudadoCapsula = 0;
        let totalRecaudadoIndefinido = 0;
        const prestamosVencidosDetalle = [];
        const prestamosPorVencer = [];
        for (const loan of loans) {
            dineroRestado += Number(loan.amount);
            capitalRecuperado += Number(loan.totalCapitalPaid || 0);
            interesRecabado += Number(loan.totalInterestPaid || 0);
            const totalRecaudadoLoan = Number(loan.totalCapitalPaid || 0) +
                Number(loan.totalInterestPaid || 0);
            if (loan.loanType === 'capsula') {
                totalRecaudadoCapsula += totalRecaudadoLoan;
            }
            else if (loan.loanType === 'indefinido') {
                totalRecaudadoIndefinido += totalRecaudadoLoan;
            }
            if (loan.status === loan_entity_1.LoanStatus.ACTIVE) {
                capitalEnTransito += Number(loan.currentBalance || 0);
            }
            const isOverdue = this.isLoanOverdue(loan);
            if (isOverdue && loan.status === loan_entity_1.LoanStatus.ACTIVE) {
                prestamosVencidos++;
                montoVencido += Number(loan.currentBalance || 0);
                prestamosVencidosDetalle.push({
                    id: loan.id,
                    customer: `${loan.customer?.firstName} ${loan.customer?.lastName}`,
                    amount: loan.amount,
                    currentBalance: loan.currentBalance,
                    lastPaymentDate: loan.lastPaymentDate,
                    monthsPaid: loan.monthsPaid,
                    daysSinceLastPayment: this.getDaysSinceLastPayment(loan.lastPaymentDate),
                });
            }
            if (loan.status === loan_entity_1.LoanStatus.ACTIVE && !isOverdue) {
                const daysSinceLastPayment = this.getDaysSinceLastPayment(loan.lastPaymentDate);
                if (daysSinceLastPayment >= 23) {
                    prestamosPorVencer.push({
                        id: loan.id,
                        customer: `${loan.customer?.firstName} ${loan.customer?.lastName}`,
                        currentBalance: loan.currentBalance,
                        monthlyPayment: Math.ceil((loan.currentBalance || 0) * 0.05),
                        daysSinceLastPayment,
                    });
                }
            }
        }
        const intersesMensual = await this.getMonthlyInterest();
        const prestamosActivos = loans.filter((l) => l.status === loan_entity_1.LoanStatus.ACTIVE).length;
        const prestamosCompletados = loans.filter((l) => l.status === loan_entity_1.LoanStatus.PAID).length;
        return {
            dineroRestado,
            capitalRecuperado,
            interesRecabado,
            cargosExtrasRecaudados,
            capitalEnTransito,
            intersesMensual,
            prestamosVencidos,
            montoVencido,
            totalPrestamos: loans.length,
            prestamosActivos,
            prestamosCompletados,
            totalRecaudadoCapsula,
            totalRecaudadoIndefinido,
            prestamosVencidosDetalle: prestamosVencidosDetalle.sort((a, b) => b.daysSinceLastPayment - a.daysSinceLastPayment),
            prestamosPorVencer: prestamosPorVencer.sort((a, b) => b.daysSinceLastPayment - a.daysSinceLastPayment),
        };
    }
    async getMonthlyInterest() {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const payments = await this.paymentsRepository
            .createQueryBuilder('payment')
            .where('payment.paymentDate >= :start', { start: startOfMonth })
            .andWhere('payment.paymentDate <= :end', { end: endOfMonth })
            .getMany();
        return payments.reduce((total, payment) => total + Number(payment.interestPaid || 0), 0);
    }
    isLoanOverdue(loan) {
        if (!loan.lastPaymentDate) {
            const daysSinceLoan = this.getDaysSinceDate(loan.loanDate);
            return daysSinceLoan > 30;
        }
        const daysSinceLastPayment = this.getDaysSinceLastPayment(loan.lastPaymentDate);
        return daysSinceLastPayment > 30;
    }
    getDaysSinceLastPayment(lastPaymentDate) {
        if (!lastPaymentDate)
            return 0;
        return this.getDaysSinceDate(lastPaymentDate);
    }
    getDaysSinceDate(date) {
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - new Date(date).getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    async getLoansWithPaymentStatus() {
        const loans = await this.loansRepository.find({
            relations: ['customer', 'payments'],
            order: { loanDate: 'DESC' },
        });
        return loans.map((loan) => {
            const isOverdue = this.isLoanOverdue(loan);
            const hasPaidThisMonth = this.hasPaidThisMonth(loan);
            return {
                ...loan,
                paymentStatus: {
                    isOverdue,
                    hasPaidThisMonth,
                    daysSinceLastPayment: this.getDaysSinceLastPayment(loan.lastPaymentDate),
                    monthlyPayment: Math.ceil((loan.currentBalance || 0) * 0.05),
                    status: isOverdue
                        ? 'overdue'
                        : hasPaidThisMonth
                            ? 'current'
                            : 'pending',
                },
            };
        });
    }
    hasPaidThisMonth(loan) {
        if (!loan.lastPaymentDate)
            return false;
        const now = new Date();
        const lastPayment = new Date(loan.lastPaymentDate);
        return (lastPayment.getMonth() === now.getMonth() &&
            lastPayment.getFullYear() === now.getFullYear());
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(loan_entity_1.Loan)),
    __param(1, (0, typeorm_1.InjectRepository)(payment_entity_1.Payment)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map