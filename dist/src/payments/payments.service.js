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
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const payment_entity_1 = require("./entities/payment.entity");
const loan_entity_1 = require("../loans/entities/loan.entity");
const monthly_payment_entity_1 = require("../loans/entities/monthly-payment.entity");
const cash_movements_service_1 = require("../cash-movements/cash-movements.service");
const cash_movement_entity_1 = require("../cash-movements/entities/cash-movement.entity");
const loans_service_1 = require("../loans/loans.service");
function roundTwo(v) {
    return Math.round(v * 100) / 100;
}
let PaymentsService = class PaymentsService {
    paymentsRepository;
    loansService;
    cashMovementsService;
    entityManager;
    constructor(paymentsRepository, loansService, cashMovementsService, entityManager) {
        this.paymentsRepository = paymentsRepository;
        this.loansService = loansService;
        this.cashMovementsService = cashMovementsService;
        this.entityManager = entityManager;
    }
    parseLocalDate(d) {
        if (typeof d === 'string') {
            const [y, m, day] = d.split('-').map(Number);
            return new Date(y, m - 1, day);
        }
        return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    }
    async create(createPaymentDto, userId) {
        const { loanId, paymentDate, paymentMethod, notes, overduePeriodsPaid, lateInterest } = createPaymentDto;
        let totalPaymentReceived;
        let actualCapitalPaid;
        let actualInterestPaid;
        try {
            return await this.entityManager.transaction(async (transactionalEntityManager) => {
                await transactionalEntityManager.findOne(loan_entity_1.Loan, {
                    where: { id: loanId },
                    lock: { mode: 'pessimistic_write' },
                });
                const loan = await transactionalEntityManager.findOne(loan_entity_1.Loan, {
                    where: { id: loanId },
                    relations: ['monthlyPayments'],
                });
                if (!loan) {
                    throw new common_1.NotFoundException('Préstamo no encontrado');
                }
                if (loan.status !== loan_entity_1.LoanStatus.ACTIVE && loan.status !== loan_entity_1.LoanStatus.OVERDUE) {
                    throw new common_1.BadRequestException('No se puede pagar un préstamo inactivo o pagado');
                }
                const currentBalance = Number(loan.currentBalance);
                const loanAmount = Number(loan.amount);
                if (currentBalance <= 0) {
                    throw new common_1.BadRequestException('El préstamo ya está pagado completamente');
                }
                if (overduePeriodsPaid && overduePeriodsPaid > 0) {
                    if (loan.loanType !== 'Cápsula') {
                        throw new common_1.BadRequestException('El pago de periodos vencidos solo está disponible para préstamos tipo Cápsula.');
                    }
                    const overdueMonthlyPayments = loan.monthlyPayments
                        .filter(mp => !mp.isPaid && this.parseLocalDate(mp.dueDate) < new Date())
                        .sort((a, b) => this.parseLocalDate(a.dueDate).getTime() - this.parseLocalDate(b.dueDate).getTime());
                    if (overduePeriodsPaid > overdueMonthlyPayments.length) {
                        throw new common_1.BadRequestException('El número de periodos a pagar excede los periodos vencidos.');
                    }
                    let totalAmountPaid = 0;
                    let totalCapitalPaidFromOverdue = 0;
                    let totalInterestPaidFromOverdue = 0;
                    for (let i = 0; i < overduePeriodsPaid; i++) {
                        const mp = overdueMonthlyPayments[i];
                        const expectedAmount = Number(mp.expectedAmount);
                        totalAmountPaid = totalAmountPaid + expectedAmount;
                        const monthlyInterestRate = parseFloat(loan.monthlyInterestRate) / 100;
                        let interestRateForPeriod = monthlyInterestRate;
                        if (loan.modality === 'quincenas') {
                            interestRateForPeriod = monthlyInterestRate / 2;
                        }
                        const interestForPeriod = roundTwo(loanAmount * interestRateForPeriod);
                        let interestPaidForPeriod;
                        let capitalPaidForPeriod;
                        if (expectedAmount > interestForPeriod) {
                            interestPaidForPeriod = interestForPeriod;
                            capitalPaidForPeriod = expectedAmount - interestForPeriod;
                        }
                        else {
                            interestPaidForPeriod = expectedAmount;
                            capitalPaidForPeriod = 0;
                        }
                        totalInterestPaidFromOverdue = totalInterestPaidFromOverdue + interestPaidForPeriod;
                        totalCapitalPaidFromOverdue = totalCapitalPaidFromOverdue + capitalPaidForPeriod;
                        mp.isPaid = true;
                        mp.paidAmount = expectedAmount;
                        mp.paymentDate = this.parseLocalDate(paymentDate);
                        mp.interestPaid = interestPaidForPeriod;
                        mp.capitalPaid = capitalPaidForPeriod;
                        await transactionalEntityManager.save(monthly_payment_entity_1.MonthlyPayment, mp);
                    }
                    actualCapitalPaid = totalCapitalPaidFromOverdue;
                    actualInterestPaid = totalInterestPaidFromOverdue;
                    totalPaymentReceived = totalAmountPaid;
                    loan.monthsPaid = (loan.monthsPaid || 0) + overduePeriodsPaid;
                    loan.currentBalance = currentBalance - totalPaymentReceived;
                }
                else {
                    if (createPaymentDto.amount !== undefined && createPaymentDto.amount !== null) {
                        totalPaymentReceived = createPaymentDto.amount;
                        if (totalPaymentReceived <= 0) {
                            throw new common_1.BadRequestException('El monto del pago debe ser mayor a 0');
                        }
                        if (loan.loanType === 'Cápsula' && loan.monthlyPayments) {
                            const nextUnpaidForValidation = loan.monthlyPayments
                                .filter(mp => !mp.isPaid)
                                .sort((a, b) => this.parseLocalDate(a.dueDate).getTime() - this.parseLocalDate(b.dueDate).getTime())[0];
                            const minPayment = nextUnpaidForValidation
                                ? Math.min(Number(nextUnpaidForValidation.expectedAmount), currentBalance)
                                : currentBalance;
                            if (totalPaymentReceived < minPayment) {
                                throw new common_1.BadRequestException(`No se permiten pagos parciales en préstamos tipo Cápsula. El monto mínimo es $${minPayment.toLocaleString('es-MX')}.`);
                            }
                        }
                        const monthlyInterestRate = parseFloat(loan.monthlyInterestRate) / 100;
                        let interestRateForPeriod = monthlyInterestRate;
                        if (loan.loanType === 'Cápsula' && loan.modality === 'quincenas') {
                            interestRateForPeriod = monthlyInterestRate / 2;
                        }
                        const interestBase = loan.loanType === 'Cápsula' ? loanAmount : currentBalance;
                        const interestForPeriod = roundTwo(interestBase * interestRateForPeriod);
                        if (totalPaymentReceived > interestForPeriod) {
                            actualInterestPaid = interestForPeriod;
                            actualCapitalPaid = totalPaymentReceived - interestForPeriod;
                        }
                        else {
                            actualInterestPaid = totalPaymentReceived;
                            actualCapitalPaid = 0;
                        }
                        if (actualCapitalPaid > currentBalance) {
                            actualCapitalPaid = currentBalance;
                        }
                        if (loan.loanType === 'Cápsula') {
                            loan.currentBalance = currentBalance - totalPaymentReceived;
                        }
                        else {
                            loan.currentBalance = currentBalance - actualCapitalPaid;
                        }
                        loan.monthsPaid = (loan.monthsPaid || 0) + 1;
                        if (loan.monthlyPayments && loan.monthlyPayments.length > 0) {
                            const nextUnpaid = loan.monthlyPayments
                                .filter(mp => !mp.isPaid)
                                .sort((a, b) => this.parseLocalDate(a.dueDate).getTime() - this.parseLocalDate(b.dueDate).getTime())[0];
                            if (nextUnpaid) {
                                nextUnpaid.isPaid = true;
                                nextUnpaid.paidAmount = totalPaymentReceived;
                                nextUnpaid.paymentDate = this.parseLocalDate(paymentDate);
                                nextUnpaid.interestPaid = actualInterestPaid;
                                nextUnpaid.capitalPaid = actualCapitalPaid;
                                await transactionalEntityManager.save(monthly_payment_entity_1.MonthlyPayment, nextUnpaid);
                            }
                        }
                    }
                    else if ((createPaymentDto.capitalAmount !== undefined && createPaymentDto.capitalAmount !== null) || (createPaymentDto.interestAmount !== undefined && createPaymentDto.interestAmount !== null)) {
                        actualCapitalPaid = createPaymentDto.capitalAmount || 0;
                        actualInterestPaid = createPaymentDto.interestAmount || 0;
                        totalPaymentReceived = actualCapitalPaid + actualInterestPaid;
                        if (totalPaymentReceived <= 0) {
                            throw new common_1.BadRequestException('El monto total del pago (capital + interés) debe ser mayor a 0');
                        }
                        if (actualCapitalPaid > currentBalance) {
                            actualCapitalPaid = currentBalance;
                        }
                        loan.currentBalance = currentBalance - actualCapitalPaid;
                    }
                    else {
                        throw new common_1.BadRequestException('Debe proporcionar un monto de pago válido.');
                    }
                }
                loan.totalInterestPaid = Number(loan.totalInterestPaid) + actualInterestPaid;
                loan.totalCapitalPaid = Number(loan.totalCapitalPaid) + actualCapitalPaid;
                loan.lastPaymentDate = this.parseLocalDate(paymentDate);
                if (loan.currentBalance <= 0) {
                    loan.currentBalance = 0;
                    loan.status = loan_entity_1.LoanStatus.PAID;
                }
                else if (loan.status === loan_entity_1.LoanStatus.OVERDUE) {
                    loan.status = loan_entity_1.LoanStatus.ACTIVE;
                }
                await transactionalEntityManager.save(loan_entity_1.Loan, loan);
                let paymentType = payment_entity_1.PaymentType.INTEREST;
                if (actualCapitalPaid > 0 && actualInterestPaid > 0) {
                    paymentType = payment_entity_1.PaymentType.BOTH;
                }
                else if (actualCapitalPaid > 0 && actualInterestPaid === 0) {
                    paymentType = payment_entity_1.PaymentType.CAPITAL;
                }
                const receiptNumber = await this.generateReceiptNumber(transactionalEntityManager);
                const payment = transactionalEntityManager.create(payment_entity_1.Payment, {
                    loan,
                    paymentDate: this.parseLocalDate(paymentDate),
                    amount: totalPaymentReceived,
                    paymentType,
                    paymentMethod: paymentMethod ?? 'CASH',
                    receiptNumber,
                    notes: notes ?? '',
                    interestPaid: actualInterestPaid,
                    capitalPaid: actualCapitalPaid,
                    lateInterest: lateInterest || 0,
                    createdBy: { id: userId },
                });
                const savedPayment = await transactionalEntityManager.save(payment_entity_1.Payment, payment);
                const lateInterestAmount = lateInterest || 0;
                const totalWithLateInterest = totalPaymentReceived + lateInterestAmount;
                await this.cashMovementsService.recordMovement(cash_movement_entity_1.MovementType.PAYMENT_IN, totalWithLateInterest, `Pago #${savedPayment.id} - Préstamo #${loanId} - Recibo: ${receiptNumber} - Interés: ${actualInterestPaid}, Capital: ${actualCapitalPaid}${lateInterestAmount > 0 ? `, Interés por mora: ${lateInterestAmount}` : ''}`, userId, 'payment', savedPayment.id, transactionalEntityManager);
                return savedPayment;
            });
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException || error instanceof common_1.BadRequestException) {
                throw error;
            }
            console.error('Payment processing error:', error);
            throw new common_1.InternalServerErrorException('Error al procesar el pago. Por favor, intente de nuevo más tarde.');
        }
    }
    async generateReceiptNumber(manager) {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const startOfMonth = new Date(year, date.getMonth(), 1);
        const endOfMonth = new Date(year, date.getMonth() + 1, 0);
        const count = await manager.count(payment_entity_1.Payment, {
            where: {
                createdAt: (0, typeorm_2.Between)(startOfMonth, endOfMonth),
            },
        });
        const sequential = String(count + 1).padStart(4, '0');
        return `REC-${year}${month}-${sequential}`;
    }
    async findAll() {
        return this.paymentsRepository
            .createQueryBuilder('payment')
            .leftJoinAndSelect('payment.loan', 'loan')
            .leftJoinAndSelect('loan.customer', 'customer')
            .leftJoinAndSelect('payment.createdBy', 'createdBy')
            .orderBy('payment.createdAt', 'DESC')
            .getMany();
    }
    async findByLoan(loanId) {
        return this.paymentsRepository
            .createQueryBuilder('payment')
            .leftJoinAndSelect('payment.loan', 'loan')
            .leftJoinAndSelect('loan.customer', 'customer')
            .where('payment.loan_id = :loanId', { loanId })
            .orderBy('payment.paymentDate', 'DESC')
            .getMany();
    }
    async findOne(id) {
        const payment = await this.paymentsRepository
            .createQueryBuilder('payment')
            .leftJoinAndSelect('payment.loan', 'loan')
            .leftJoinAndSelect('loan.customer', 'customer')
            .leftJoinAndSelect('payment.createdBy', 'createdBy')
            .where('payment.id = :id', { id })
            .getOne();
        if (!payment) {
            throw new common_1.NotFoundException('Pago no encontrado');
        }
        return payment;
    }
    async getPaymentHistory(loanId) {
        const loan = await this.loansService.findOne(loanId);
        if (!loan) {
            throw new common_1.NotFoundException('Préstamo no encontrado');
        }
        const payments = await this.findByLoan(loanId);
        const summary = {
            totalPaid: loan.totalInterestPaid + loan.totalCapitalPaid,
            totalInterest: loan.totalInterestPaid,
            totalCapital: loan.totalCapitalPaid,
            monthsPaid: loan.monthsPaid,
            remainingBalance: loan.currentBalance,
            monthlyPayment: roundTwo(loan.currentBalance * (parseFloat(loan.monthlyInterestRate) / 100)),
        };
        return { payments, summary };
    }
    async findByDateRange(startDate, endDate) {
        return this.paymentsRepository
            .createQueryBuilder('payment')
            .leftJoinAndSelect('payment.loan', 'loan')
            .leftJoinAndSelect('loan.customer', 'customer')
            .where('payment.paymentDate BETWEEN :startDate AND :endDate', {
            startDate,
            endDate,
        })
            .orderBy('payment.paymentDate', 'DESC')
            .getMany();
    }
    async getOverdueLoans() {
        return this.loansService.findOverdueLoans();
    }
    async remove(id) {
        const payment = await this.findOne(id);
        await this.entityManager.transaction(async (transactionalEntityManager) => {
            const loan = await transactionalEntityManager.findOne(loan_entity_1.Loan, {
                where: { id: payment.loan.id },
                lock: { mode: 'pessimistic_write' },
            });
            if (!loan) {
                throw new common_1.NotFoundException('Préstamo asociado no encontrado.');
            }
            const paymentCapitalPaid = payment.capitalPaid;
            const paymentInterestPaid = payment.interestPaid;
            if (loan.loanType === 'Cápsula') {
                loan.currentBalance = loan.currentBalance + payment.amount;
            }
            else {
                loan.currentBalance = loan.currentBalance + paymentCapitalPaid;
            }
            loan.totalInterestPaid = loan.totalInterestPaid - paymentInterestPaid;
            loan.totalCapitalPaid = loan.totalCapitalPaid - paymentCapitalPaid;
            if (loan.status === loan_entity_1.LoanStatus.PAID) {
                loan.status = loan_entity_1.LoanStatus.ACTIVE;
            }
            await transactionalEntityManager.save(loan_entity_1.Loan, loan);
            await transactionalEntityManager.remove(payment_entity_1.Payment, payment);
            await this.cashMovementsService.revertMovement('payment', id, transactionalEntityManager);
        });
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(payment_entity_1.Payment)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        loans_service_1.LoansService,
        cash_movements_service_1.CashMovementsService,
        typeorm_2.EntityManager])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map