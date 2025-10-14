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
exports.LoansService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const loan_entity_1 = require("./entities/loan.entity");
const monthly_payment_entity_1 = require("./entities/monthly-payment.entity");
const cash_movements_service_1 = require("../cash-movements/cash-movements.service");
const cash_movement_entity_1 = require("../cash-movements/entities/cash-movement.entity");
function getLastDayOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}
let LoansService = class LoansService {
    loansRepository;
    monthlyPaymentRepository;
    cashMovementsService;
    entityManager;
    constructor(loansRepository, monthlyPaymentRepository, cashMovementsService, entityManager) {
        this.loansRepository = loansRepository;
        this.monthlyPaymentRepository = monthlyPaymentRepository;
        this.cashMovementsService = cashMovementsService;
        this.entityManager = entityManager;
    }
    async create(createLoanDto, userId) {
        return this.entityManager.transaction(async (transactionalEntityManager) => {
            const { amount, customerId } = createLoanDto;
            const loan = transactionalEntityManager.create(loan_entity_1.Loan, {
                ...createLoanDto,
                currentBalance: Math.ceil(createLoanDto.totalToPay || createLoanDto.amount),
                monthlyInterestRate: createLoanDto.monthlyInterestRate || '5',
                term: createLoanDto.term,
                modality: createLoanDto.modality,
                customer: { id: customerId },
                createdBy: { id: userId },
            });
            const savedLoan = await transactionalEntityManager.save(loan);
            if (savedLoan.term || savedLoan.loanType === 'Indefinido') {
                await this.createMonthlyPayment(savedLoan, transactionalEntityManager);
            }
            await this.cashMovementsService.recordMovement(cash_movement_entity_1.MovementType.LOAN_OUT, amount, `Préstamo #${savedLoan.id} - Cliente ID: ${customerId}`, userId, 'loan', savedLoan.id, transactionalEntityManager);
            return savedLoan;
        });
    }
    async findOne(id, manager) {
        const repository = manager
            ? manager.getRepository(loan_entity_1.Loan)
            : this.loansRepository;
        const loan = await repository.findOne({ where: { id } });
        if (!loan) {
            throw new common_1.NotFoundException(`Préstamo con ID ${id} no encontrado`);
        }
        return loan;
    }
    async findByCustomer(customerId) {
        return this.loansRepository.find({
            where: { customer: { id: customerId } },
            relations: ['payments', 'monthlyPayments'],
            order: { loanDate: 'DESC' },
        });
    }
    async remove(id) {
        const result = await this.loansRepository.delete(id);
        if (result.affected === 0) {
            throw new common_1.NotFoundException(`Loan with ID ${id} not found`);
        }
    }
    async createMonthlyPayment(loan, manager) {
        const monthlyInterestRate = parseFloat(loan.monthlyInterestRate) / 100;
        const loanAmount = loan.amount;
        let numPayments;
        let expectedAmount;
        let totalToPay;
        const monthlyPaymentsToSave = [];
        if (loan.loanType === 'Cápsula') {
            if (!loan.term) {
                throw new common_1.BadRequestException('El plazo (term) es requerido para préstamos tipo Cápsula.');
            }
            if (loan.modality === 'quincenas') {
                const numberOfMonths = loan.term / 2;
                const totalToPayTheoretical = Math.ceil((loanAmount * monthlyInterestRate * numberOfMonths) + loanAmount);
                numPayments = loan.term;
                expectedAmount = Math.ceil(totalToPayTheoretical / numPayments);
                totalToPay = expectedAmount * numPayments;
            }
            else {
                const totalToPayTheoretical = Math.ceil((loanAmount * monthlyInterestRate * loan.term) + loanAmount);
                numPayments = loan.term;
                expectedAmount = Math.ceil(totalToPayTheoretical / numPayments);
                totalToPay = expectedAmount * numPayments;
            }
        }
        else if (loan.loanType === 'Indefinido') {
            numPayments = 60;
            expectedAmount = Math.ceil(loanAmount * monthlyInterestRate);
        }
        else {
            throw new common_1.BadRequestException('Tipo de préstamo no soportado para la generación de pagos.');
        }
        const currentDueDate = new Date(loan.loanDate);
        let lastDueDateWas15th = false;
        for (let i = 0; i < numPayments; i++) {
            let dueDate;
            if (loan.loanType === 'Cápsula' && loan.modality === 'quincenas') {
                if (i === 0) {
                    if (currentDueDate.getDate() <= 15) {
                        dueDate = new Date(currentDueDate.getFullYear(), currentDueDate.getMonth(), 15);
                        lastDueDateWas15th = true;
                    }
                    else {
                        dueDate = getLastDayOfMonth(currentDueDate);
                        lastDueDateWas15th = false;
                    }
                }
                else {
                    if (lastDueDateWas15th) {
                        dueDate = getLastDayOfMonth(currentDueDate);
                        lastDueDateWas15th = false;
                    }
                    else {
                        currentDueDate.setMonth(currentDueDate.getMonth() + 1);
                        dueDate = new Date(currentDueDate.getFullYear(), currentDueDate.getMonth(), 15);
                        lastDueDateWas15th = true;
                    }
                }
            }
            else {
                if (i > 0) {
                    currentDueDate.setMonth(currentDueDate.getMonth() + 1);
                }
                dueDate = getLastDayOfMonth(currentDueDate);
            }
            const monthlyPayment = manager.create(monthly_payment_entity_1.MonthlyPayment, {
                loan,
                dueDate,
                expectedAmount: expectedAmount,
                isPaid: false,
            });
            monthlyPaymentsToSave.push(monthlyPayment);
        }
        await manager.save(monthlyPaymentsToSave);
    }
    async findAll() {
        const loans = await this.loansRepository.find({
            relations: ['customer', 'payments', 'monthlyPayments'],
            order: { loanDate: 'DESC' },
        });
        for (const loan of loans) {
            if (loan.status === loan_entity_1.LoanStatus.ACTIVE) {
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const overduePayments = loan.monthlyPayments.filter((mp) => {
                    const dueDate = new Date(mp.dueDate);
                    const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
                    return !mp.isPaid && dueDateOnly < today;
                });
                if (overduePayments.length > 0) {
                    loan.status = loan_entity_1.LoanStatus.OVERDUE;
                }
            }
        }
        return loans;
    }
    async getLoanDetails(loanId) {
        const loan = await this.loansRepository.findOne({
            where: { id: loanId },
            relations: ['customer', 'payments', 'monthlyPayments'],
        });
        if (!loan) {
            throw new common_1.NotFoundException(`Préstamo con ID ${loanId} no encontrado`);
        }
        let accumulatedOverdueAmount = 0;
        let overduePeriodsCount = 0;
        if (loan.monthlyPayments && loan.monthlyPayments.length > 0) {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            for (const mp of loan.monthlyPayments) {
                const dueDate = new Date(mp.dueDate);
                const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
                if (!mp.isPaid && dueDateOnly < today) {
                    accumulatedOverdueAmount = accumulatedOverdueAmount + mp.expectedAmount;
                    overduePeriodsCount++;
                }
            }
        }
        let totalExtraChargesPaid = 0;
        return {
            ...loan,
            monthlyPaymentAmount: Math.ceil(loan.currentBalance * (parseFloat(loan.monthlyInterestRate) / 100)),
            paymentHistory: loan.monthlyPayments
                .filter((mp) => mp.isPaid)
                .sort((a, b) => new Date(b.paymentDate).getTime() -
                new Date(a.paymentDate).getTime()),
            accumulatedOverdueAmount: accumulatedOverdueAmount,
            overduePeriodsCount: overduePeriodsCount,
            overduePeriodsUnit: loan.modality === 'quincenas' ? 'quincenas' : 'meses',
            totalExtraChargesPaid: totalExtraChargesPaid,
        };
    }
    async findOverdueLoans() {
        const currentDate = new Date();
        const thirtyDaysAgo = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        const overdueLoans = await this.loansRepository
            .createQueryBuilder('loan')
            .leftJoin('loan.customer', 'customer')
            .where('loan.status = :status', { status: loan_entity_1.LoanStatus.ACTIVE })
            .andWhere('loan.currentBalance > 0')
            .andWhere('(loan.lastPaymentDate IS NULL AND loan.loanDate < :thirtyDaysAgo) OR (loan.lastPaymentDate IS NOT NULL AND loan.lastPaymentDate < :thirtyDaysAgo)', { thirtyDaysAgo })
            .select(['loan', 'customer.firstName', 'customer.lastName'])
            .getMany();
        const totalAmount = overdueLoans.reduce((sum, loan) => sum + (loan.currentBalance || 0), 0);
        return {
            count: overdueLoans.length,
            totalAmount,
            loans: overdueLoans,
        };
    }
    async getCompletedLoans() {
        try {
            const completedLoans = await this.loansRepository.find({
                where: {
                    status: loan_entity_1.LoanStatus.PAID,
                },
                relations: ['customer'],
                order: { loanDate: 'DESC' },
            });
            return completedLoans;
        }
        catch (error) {
            console.error('Error in getCompletedLoans:', error);
            throw error;
        }
    }
    async getDashboardStats() {
        const loans = await this.loansRepository.find({
            relations: ['monthlyPayments', 'payments'],
        });
        let totalLoaned = 0;
        let capitalRecovered = 0;
        let interestCollected = 0;
        let extraChargesCollected = 0;
        let capitalInTransit = 0;
        let overdueCount = 0;
        let overdueAmount = 0;
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        let monthlyInterest = 0;
        for (const loan of loans) {
            totalLoaned = totalLoaned + loan.amount;
            capitalRecovered = capitalRecovered + loan.totalCapitalPaid;
            interestCollected = interestCollected + loan.totalInterestPaid;
            if (loan.status === loan_entity_1.LoanStatus.ACTIVE) {
                capitalInTransit = capitalInTransit + loan.currentBalance;
            }
            const currentMonthPayments = loan.monthlyPayments.filter((mp) => {
                const paymentDate = new Date(mp.paymentDate);
                return (mp.isPaid &&
                    paymentDate.getMonth() === currentMonth &&
                    paymentDate.getFullYear() === currentYear);
            });
            for (const payment of currentMonthPayments) {
                monthlyInterest = monthlyInterest + payment.interestPaid;
            }
            const hasOverduePayments = loan.monthlyPayments.some((mp) => !mp.isPaid && new Date(mp.dueDate) < new Date());
            if (hasOverduePayments) {
                overdueCount++;
                overdueAmount = overdueAmount + loan.currentBalance;
            }
        }
        return {
            totalLoaned: totalLoaned,
            capitalRecovered: capitalRecovered,
            interestCollected: interestCollected,
            extraChargesCollected: extraChargesCollected,
            capitalInTransit: capitalInTransit,
            monthlyInterest: monthlyInterest,
            overdueCount,
            overdueAmount: overdueAmount,
            activeLoans: loans.filter((l) => l.status === loan_entity_1.LoanStatus.ACTIVE).length,
            totalLoans: loans.length,
        };
    }
};
exports.LoansService = LoansService;
exports.LoansService = LoansService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(loan_entity_1.Loan)),
    __param(1, (0, typeorm_1.InjectRepository)(monthly_payment_entity_1.MonthlyPayment)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        cash_movements_service_1.CashMovementsService,
        typeorm_2.EntityManager])
], LoansService);
//# sourceMappingURL=loans.service.js.map