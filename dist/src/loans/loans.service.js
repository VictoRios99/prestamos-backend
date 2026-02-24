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
function roundTwo(v) {
    return Math.round(v * 100) / 100;
}
function addOneMonth(date) {
    const refDay = date.getDate();
    const next = new Date(date.getFullYear(), date.getMonth() + 1, refDay);
    if (next.getDate() !== refDay) {
        return new Date(date.getFullYear(), date.getMonth() + 2, 0);
    }
    return next;
}
function countOverdueMonths(referenceDate, today) {
    const ref = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
    let meses = 0;
    let checkDate = addOneMonth(ref);
    while (checkDate < today) {
        meses++;
        checkDate = addOneMonth(checkDate);
    }
    return meses;
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
                currentBalance: roundTwo(createLoanDto.totalToPay || createLoanDto.amount),
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
                const totalToPayTheoretical = roundTwo((loanAmount * monthlyInterestRate * numberOfMonths) + loanAmount);
                numPayments = loan.term;
                expectedAmount = roundTwo(totalToPayTheoretical / numPayments);
                totalToPay = roundTwo(expectedAmount * numPayments);
            }
            else {
                const totalToPayTheoretical = roundTwo((loanAmount * monthlyInterestRate * loan.term) + loanAmount);
                numPayments = loan.term;
                expectedAmount = roundTwo(totalToPayTheoretical / numPayments);
                totalToPay = roundTwo(expectedAmount * numPayments);
            }
        }
        else if (loan.loanType === 'Indefinido') {
            numPayments = 60;
            expectedAmount = roundTwo(loanAmount * monthlyInterestRate);
        }
        else {
            throw new common_1.BadRequestException('Tipo de préstamo no soportado para la generación de pagos.');
        }
        const loanDate = new Date(loan.loanDate);
        const lDay = loanDate.getDate();
        const lMonth = loanDate.getMonth();
        const lYear = loanDate.getFullYear();
        const dueDates = [];
        if (loan.modality === 'quincenas') {
            let curMonth, curYear, nextIs15;
            if (lDay <= 15) {
                curMonth = lMonth;
                curYear = lYear;
                nextIs15 = false;
            }
            else {
                curMonth = lMonth + 1;
                curYear = lYear;
                if (curMonth > 11) {
                    curMonth = 0;
                    curYear++;
                }
                nextIs15 = true;
            }
            for (let i = 0; i < numPayments; i++) {
                if (nextIs15) {
                    dueDates.push(new Date(curYear, curMonth, 15));
                    nextIs15 = false;
                }
                else {
                    dueDates.push(new Date(curYear, curMonth + 1, 0));
                    nextIs15 = true;
                    curMonth++;
                    if (curMonth > 11) {
                        curMonth = 0;
                        curYear++;
                    }
                }
            }
        }
        else {
            let startMonth, startYear;
            if (lDay <= 15) {
                startMonth = lMonth;
                startYear = lYear;
            }
            else {
                startMonth = lMonth + 1;
                startYear = lYear;
                if (startMonth > 11) {
                    startMonth = 0;
                    startYear++;
                }
            }
            for (let i = 0; i < numPayments; i++) {
                const totalMonths = startMonth + i;
                const yr = startYear + Math.floor(totalMonths / 12);
                const mo = totalMonths % 12;
                dueDates.push(new Date(yr, mo + 1, 0));
            }
        }
        for (const dueDate of dueDates) {
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
        let overduePeriodsUnit = loan.modality === 'quincenas' ? 'quincenas' : 'meses';
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (loan.loanType === 'Indefinido') {
            const ref = loan.lastPaymentDate
                ? new Date(loan.lastPaymentDate)
                : new Date(loan.loanDate);
            overduePeriodsCount = countOverdueMonths(ref, today);
            overduePeriodsUnit = 'meses';
            const rate = parseFloat(loan.monthlyInterestRate) / 100;
            accumulatedOverdueAmount = overduePeriodsCount * Math.ceil(Number(loan.amount) * rate);
        }
        else if (loan.monthlyPayments && loan.monthlyPayments.length > 0) {
            for (const mp of loan.monthlyPayments) {
                const dueDate = new Date(mp.dueDate);
                const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
                if (!mp.isPaid && dueDateOnly < today) {
                    accumulatedOverdueAmount += Number(mp.expectedAmount || 0);
                    overduePeriodsCount++;
                }
            }
            if (overduePeriodsCount === 0 && loan.status !== loan_entity_1.LoanStatus.PAID && loan.status !== loan_entity_1.LoanStatus.CANCELLED) {
                const ref = loan.lastPaymentDate
                    ? new Date(loan.lastPaymentDate)
                    : new Date(loan.loanDate);
                overduePeriodsCount = countOverdueMonths(ref, today);
                overduePeriodsUnit = 'meses';
                const rate = parseFloat(loan.monthlyInterestRate) / 100;
                const periodRate = loan.modality === 'quincenas' ? rate / 2 : rate;
                accumulatedOverdueAmount = overduePeriodsCount * Math.ceil(Number(loan.currentBalance) * periodRate);
            }
        }
        const totalExtraChargesPaid = 0;
        let monthlyPaymentAmount;
        const rate = parseFloat(loan.monthlyInterestRate) / 100;
        if (loan.loanType === 'Cápsula' && loan.term) {
            const periodRate = loan.modality === 'quincenas' ? rate / 2 : rate;
            const totalInterest = roundTwo(Number(loan.amount) * periodRate * loan.term);
            monthlyPaymentAmount = roundTwo((Number(loan.amount) + totalInterest) / loan.term);
        }
        else if (loan.loanType === 'Cápsula' && !loan.term && loan.monthlyPayments?.length > 0) {
            monthlyPaymentAmount = Number(loan.monthlyPayments[0].expectedAmount || 0);
        }
        else {
            monthlyPaymentAmount = roundTwo(Number(loan.amount) * rate);
        }
        return {
            ...loan,
            monthlyPaymentAmount,
            paymentHistory: loan.monthlyPayments
                .filter((mp) => mp.isPaid)
                .sort((a, b) => new Date(b.paymentDate).getTime() -
                new Date(a.paymentDate).getTime()),
            accumulatedOverdueAmount: accumulatedOverdueAmount,
            overduePeriodsCount: overduePeriodsCount,
            overduePeriodsUnit: overduePeriodsUnit,
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
    async updateOverdueStatuses() {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
        const paidResult = await this.loansRepository.query(`UPDATE loans SET status = 'PAID', updated_at = NOW()
       WHERE status IN ('ACTIVE', 'OVERDUE')
       AND (current_balance <= 0 OR current_balance IS NULL AND total_capital_paid >= amount)`);
        const markedPaid = paidResult[1] || 0;
        const overdueResult = await this.loansRepository.query(`UPDATE loans SET status = 'OVERDUE', updated_at = NOW()
       WHERE status = 'ACTIVE'
       AND current_balance > 0
       AND (
         (last_payment_date IS NULL AND loan_date < $1)
         OR (last_payment_date IS NOT NULL AND last_payment_date < $1)
       )`, [thirtyDaysAgoStr]);
        const markedOverdue = overdueResult[1] || 0;
        const activeResult = await this.loansRepository.query(`UPDATE loans SET status = 'ACTIVE', updated_at = NOW()
       WHERE status = 'OVERDUE'
       AND current_balance > 0
       AND last_payment_date >= $1`, [thirtyDaysAgoStr]);
        const restoredActive = activeResult[1] || 0;
        return { markedOverdue, restoredActive, markedPaid };
    }
    async getCompletedLoans() {
        try {
            const completedLoans = await this.loansRepository.find({
                where: [
                    { status: loan_entity_1.LoanStatus.PAID },
                    { status: loan_entity_1.LoanStatus.CANCELLED },
                ],
                relations: ['customer'],
                order: { loanDate: 'DESC' },
            });
            return completedLoans;
        }
        catch (error) {
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