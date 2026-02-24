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
    toLocalDate(d) {
        if (!d)
            return new Date(0);
        if (typeof d === 'string') {
            const [y, m, day] = d.split('-').map(Number);
            return new Date(y, m - 1, day);
        }
        return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
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
        let totalRecaudadoCapsula = 0;
        let totalRecaudadoIndefinido = 0;
        let interesEsperadoCapsula = 0;
        let interesEsperadoIndefinido = 0;
        const interesEsperadoExtras = 0;
        let capitalEsperadoCapsula = 0;
        let capitalRecibidoCapsula = 0;
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const pagosAlDia = [];
        const pagosPendientes = [];
        const pagosMorosos = [];
        for (const loan of loans) {
            dineroRestado += Number(loan.amount);
            capitalRecuperado += Number(loan.totalCapitalPaid || 0);
            interesRecabado += Number(loan.totalInterestPaid || 0);
            const totalRecaudadoLoan = Number(loan.totalCapitalPaid || 0) +
                Number(loan.totalInterestPaid || 0);
            if (loan.loanType === 'Cápsula') {
                totalRecaudadoCapsula += totalRecaudadoLoan;
            }
            else if (loan.loanType === 'Indefinido') {
                totalRecaudadoIndefinido += totalRecaudadoLoan;
            }
            if (loan.status === loan_entity_1.LoanStatus.ACTIVE || loan.status === loan_entity_1.LoanStatus.OVERDUE) {
                capitalEnTransito += Math.max(0, Number(loan.amount) - Number(loan.totalCapitalPaid || 0));
            }
            if ((loan.status === loan_entity_1.LoanStatus.ACTIVE ||
                loan.status === loan_entity_1.LoanStatus.OVERDUE) &&
                Number(loan.currentBalance) > 0) {
                const customerName = `${loan.customer?.firstName || ''} ${loan.customer?.lastName || ''}`.trim();
                const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                if (loan.loanType === 'Cápsula' && loan.monthlyPayments && loan.monthlyPayments.length > 0) {
                    const allUnpaidPastDue = loan.monthlyPayments.filter(mp => !mp.isPaid && this.toLocalDate(mp.dueDate) < todayStart);
                    if (allUnpaidPastDue.length > 0) {
                        const sorted = allUnpaidPastDue.sort((a, b) => this.toLocalDate(a.dueDate).getTime() - this.toLocalDate(b.dueDate).getTime());
                        const oldestDue = this.toLocalDate(sorted[0].dueDate);
                        const diasAtraso = Math.ceil((todayStart.getTime() - oldestDue.getTime()) / 86400000);
                        const morosoDeadline = this.addOneMonth(oldestDue);
                        if (todayStart > morosoDeadline) {
                            pagosMorosos.push({
                                id: loan.id,
                                customer: customerName,
                                phone: loan.customer?.phone || '',
                                monto: Number(loan.currentBalance || 0),
                                diasAtraso,
                                loanType: loan.loanType || '',
                                mesesDeuda: allUnpaidPastDue.length,
                                diaEsperado: oldestDue.getDate(),
                            });
                        }
                        else {
                            const diasRestantes = Math.max(0, Math.ceil((morosoDeadline.getTime() - now.getTime()) / 86400000));
                            pagosPendientes.push({
                                id: loan.id,
                                customer: customerName,
                                phone: loan.customer?.phone || '',
                                monto: Number(loan.currentBalance || 0),
                                diasRestantes,
                                loanType: loan.loanType || '',
                                diaEsperado: oldestDue.getDate(),
                            });
                        }
                    }
                    else {
                        const unpaidUpcoming = loan.monthlyPayments.filter(mp => !mp.isPaid && this.toLocalDate(mp.dueDate) >= todayStart);
                        if (unpaidUpcoming.length > 0) {
                            const nextDue = unpaidUpcoming.sort((a, b) => this.toLocalDate(a.dueDate).getTime() - this.toLocalDate(b.dueDate).getTime())[0];
                            const dueDate = this.toLocalDate(nextDue.dueDate);
                            const diasRestantes = Math.max(0, Math.ceil((dueDate.getTime() - now.getTime()) / 86400000));
                            pagosPendientes.push({
                                id: loan.id,
                                customer: customerName,
                                phone: loan.customer?.phone || '',
                                monto: Number(loan.currentBalance || 0),
                                diasRestantes,
                                loanType: loan.loanType || '',
                                diaEsperado: dueDate.getDate(),
                            });
                        }
                        else {
                            const diaPago = loan.lastPaymentDate
                                ? this.toLocalDate(loan.lastPaymentDate).getDate()
                                : now.getDate();
                            pagosAlDia.push({
                                id: loan.id,
                                customer: customerName,
                                phone: loan.customer?.phone || '',
                                monto: Number(loan.currentBalance || 0),
                                loanType: loan.loanType || '',
                                diaPago,
                            });
                        }
                    }
                }
                else {
                    const nextExpected = this.getNextExpectedDateIndefinido(loan);
                    if (todayStart > nextExpected) {
                        const diasAtraso = Math.ceil((todayStart.getTime() - nextExpected.getTime()) / 86400000);
                        const mesesDeuda = this.countMissedCyclesIndefinido(loan, todayStart);
                        pagosMorosos.push({
                            id: loan.id,
                            customer: customerName,
                            phone: loan.customer?.phone || '',
                            monto: Number(loan.currentBalance || 0),
                            diasAtraso,
                            loanType: loan.loanType || '',
                            mesesDeuda,
                            diaEsperado: nextExpected.getDate(),
                        });
                    }
                    else if (this.hasPaidThisMonth(loan)) {
                        const diaPago = loan.lastPaymentDate
                            ? this.toLocalDate(loan.lastPaymentDate).getDate()
                            : now.getDate();
                        pagosAlDia.push({
                            id: loan.id,
                            customer: customerName,
                            phone: loan.customer?.phone || '',
                            monto: Number(loan.currentBalance || 0),
                            loanType: loan.loanType || '',
                            diaPago,
                        });
                    }
                    else {
                        const diasRestantes = Math.max(0, Math.ceil((nextExpected.getTime() - now.getTime()) / 86400000));
                        pagosPendientes.push({
                            id: loan.id,
                            customer: customerName,
                            phone: loan.customer?.phone || '',
                            monto: Number(loan.currentBalance || 0),
                            diasRestantes,
                            loanType: loan.loanType || '',
                            diaEsperado: nextExpected.getDate(),
                        });
                    }
                }
            }
            if (loan.status === loan_entity_1.LoanStatus.ACTIVE ||
                loan.status === loan_entity_1.LoanStatus.OVERDUE) {
                const rate = Number(loan.monthlyInterestRate || 0) / 100;
                if (loan.loanType === 'Cápsula' && loan.monthlyPayments) {
                    for (const mp of loan.monthlyPayments) {
                        const dueDate = this.toLocalDate(mp.dueDate);
                        if (dueDate.getMonth() === currentMonth &&
                            dueDate.getFullYear() === currentYear) {
                            const effectiveRate = loan.modality === 'quincenas' ? rate / 2 : rate;
                            const interesEsperado = Math.round(Number(loan.amount) * effectiveRate * 100) / 100;
                            interesEsperadoCapsula += interesEsperado;
                            const capitalEsperado = Math.max(0, Number(mp.expectedAmount) - interesEsperado);
                            capitalEsperadoCapsula += capitalEsperado;
                            if (mp.isPaid) {
                                capitalRecibidoCapsula += Number(mp.capitalPaid || 0);
                            }
                        }
                    }
                }
                else if (loan.loanType === 'Indefinido') {
                    interesEsperadoIndefinido += Math.round(Number(loan.currentBalance || 0) * rate * 100) / 100;
                }
            }
        }
        const pagosMes = await this.getMonthlyPaymentsBreakdown();
        const prestamosVencidos = pagosMorosos.length;
        const montoVencido = pagosMorosos.reduce((sum, p) => sum + p.monto, 0);
        const prestamosActivos = pagosAlDia.length + pagosPendientes.length;
        const prestamosCompletados = loans.filter((l) => l.status === loan_entity_1.LoanStatus.PAID || l.status === loan_entity_1.LoanStatus.CANCELLED).length;
        const prestamosPorVencer = pagosPendientes.map((p) => ({
            id: p.id,
            customer: p.customer,
            currentBalance: p.monto,
            diasRestantes: p.diasRestantes,
            diaEsperado: p.diaEsperado,
        }));
        const interesEsperadoTotal = interesEsperadoCapsula + interesEsperadoIndefinido + interesEsperadoExtras;
        return {
            dineroRestado,
            capitalRecuperado,
            interesRecabado,
            cargosExtrasRecaudados,
            capitalEnTransito,
            pagosRecibidosMes: pagosMes.total,
            pagosRecibidosMesCapitalCapsula: pagosMes.capitalCapsula,
            pagosRecibidosMesInteresCapsula: pagosMes.interesCapsula,
            pagosRecibidosMesCapitalIndefinido: pagosMes.capitalIndefinido,
            pagosRecibidosMesInteresIndefinido: pagosMes.interesIndefinido,
            prestamosVencidos,
            montoVencido,
            totalPrestamos: loans.length,
            prestamosActivos,
            prestamosCompletados,
            totalRecaudadoCapsula,
            totalRecaudadoIndefinido,
            interesEsperadoCapsula,
            interesEsperadoIndefinido,
            interesEsperadoExtras,
            interesEsperadoTotal,
            capitalEsperadoCapsula,
            capitalRecibidoCapsula,
            pagosAlDia,
            pagosPendientes: pagosPendientes.sort((a, b) => a.diasRestantes - b.diasRestantes),
            pagosMorosos: pagosMorosos.sort((a, b) => b.diasAtraso - a.diasAtraso),
            prestamosVencidosDetalle: pagosMorosos
                .sort((a, b) => b.diasAtraso - a.diasAtraso)
                .map((p) => ({
                id: p.id,
                customer: p.customer,
                monto: p.monto,
                diasAtraso: p.diasAtraso,
                mesesDeuda: p.mesesDeuda,
                diaEsperado: p.diaEsperado,
                loanType: p.loanType,
            })),
            prestamosPorVencer: prestamosPorVencer.sort((a, b) => a.diasRestantes - b.diasRestantes),
        };
    }
    async getMonthlyPaymentsBreakdown() {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const payments = await this.paymentsRepository
            .createQueryBuilder('payment')
            .leftJoinAndSelect('payment.loan', 'loan')
            .where('payment.paymentDate >= :start', { start: startOfMonth })
            .andWhere('payment.paymentDate <= :end', { end: endOfMonth })
            .getMany();
        let capitalCapsula = 0;
        let interesCapsula = 0;
        let capitalIndefinido = 0;
        let interesIndefinido = 0;
        for (const p of payments) {
            const cap = Number(p.capitalPaid || 0);
            const int = Number(p.interestPaid || 0);
            if (p.loan?.loanType === 'Cápsula') {
                capitalCapsula += cap;
                interesCapsula += int;
            }
            else {
                capitalIndefinido += cap;
                interesIndefinido += int;
            }
        }
        return {
            total: capitalCapsula + interesCapsula + capitalIndefinido + interesIndefinido,
            capitalCapsula,
            interesCapsula,
            capitalIndefinido,
            interesIndefinido,
        };
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
        const parsed = this.toLocalDate(date);
        const diffTime = Math.abs(now.getTime() - parsed.getTime());
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
                    monthlyPayment: Math.round((loan.currentBalance || 0) * 0.05 * 100) / 100,
                    status: isOverdue
                        ? 'overdue'
                        : hasPaidThisMonth
                            ? 'current'
                            : 'pending',
                },
            };
        });
    }
    addOneMonth(date) {
        const refDay = date.getDate();
        const next = new Date(date.getFullYear(), date.getMonth() + 1, refDay);
        if (next.getDate() !== refDay) {
            return new Date(date.getFullYear(), date.getMonth() + 2, 0);
        }
        return next;
    }
    getNextExpectedDateIndefinido(loan) {
        const referenceDate = loan.lastPaymentDate
            ? this.toLocalDate(loan.lastPaymentDate)
            : this.toLocalDate(loan.loanDate);
        return this.addOneMonth(referenceDate);
    }
    countMissedCyclesIndefinido(loan, today) {
        const ref = loan.lastPaymentDate
            ? this.toLocalDate(loan.lastPaymentDate)
            : this.toLocalDate(loan.loanDate);
        let meses = 0;
        let checkDate = this.addOneMonth(ref);
        while (checkDate < today) {
            meses++;
            checkDate = this.addOneMonth(checkDate);
        }
        return Math.max(1, meses);
    }
    isPaymentExpectedThisMonth(loan, now) {
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        if (loan.monthlyPayments && loan.monthlyPayments.length > 0) {
            return loan.monthlyPayments.some((mp) => {
                const dueDate = this.toLocalDate(mp.dueDate);
                return (dueDate.getMonth() === currentMonth &&
                    dueDate.getFullYear() === currentYear &&
                    !mp.isPaid);
            });
        }
        if (loan.lastPaymentDate) {
            const estimated = this.toLocalDate(loan.lastPaymentDate);
            estimated.setDate(estimated.getDate() + 30);
            return (estimated.getMonth() === currentMonth &&
                estimated.getFullYear() === currentYear);
        }
        return true;
    }
    getExpectedPaymentDay(loan, now) {
        if (loan.monthlyPayments && loan.monthlyPayments.length > 0) {
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            for (const mp of loan.monthlyPayments) {
                const dueDate = this.toLocalDate(mp.dueDate);
                if (dueDate.getMonth() === currentMonth &&
                    dueDate.getFullYear() === currentYear &&
                    !mp.isPaid) {
                    return dueDate.getDate();
                }
            }
        }
        if (loan.lastPaymentDate) {
            const estimated = this.toLocalDate(loan.lastPaymentDate);
            estimated.setDate(estimated.getDate() + 30);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            return Math.min(estimated.getDate(), lastDay);
        }
        return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    }
    hasPaidThisMonth(loan) {
        if (!loan.lastPaymentDate)
            return false;
        const now = new Date();
        const lastPayment = this.toLocalDate(loan.lastPaymentDate);
        return (lastPayment.getMonth() === now.getMonth() &&
            lastPayment.getFullYear() === now.getFullYear());
    }
    async getCapitalDistribution() {
        const loans = await this.loansRepository.find({
            relations: ['customer'],
            where: [
                { status: loan_entity_1.LoanStatus.ACTIVE },
                { status: loan_entity_1.LoanStatus.OVERDUE },
            ],
        });
        const customerMap = new Map();
        for (const loan of loans) {
            const customerId = loan.customer?.id || 0;
            const customerName = `${loan.customer?.firstName || ''} ${loan.customer?.lastName || ''}`.trim();
            const loanCapital = Math.max(0, Number(loan.amount) - Number(loan.totalCapitalPaid || 0));
            if (!customerMap.has(customerId)) {
                customerMap.set(customerId, { name: customerName, capital: 0, loans: [] });
            }
            const entry = customerMap.get(customerId);
            entry.capital += loanCapital;
            entry.loans.push({ id: loan.id, type: loan.loanType || '', capital: loanCapital, amount: Number(loan.amount), status: loan.status });
        }
        const totalCapital = Array.from(customerMap.values()).reduce((sum, c) => sum + c.capital, 0);
        return Array.from(customerMap.entries())
            .map(([customerId, data]) => ({
            customerId,
            customerName: data.name,
            capitalEnTransito: data.capital,
            percentage: totalCapital > 0 ? Math.round((data.capital / totalCapital) * 1000) / 10 : 0,
            loanCount: data.loans.length,
            loans: data.loans,
        }))
            .sort((a, b) => b.capitalEnTransito - a.capitalEnTransito);
    }
    async getPaymentActivityLog(month, year) {
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0);
        const payments = await this.paymentsRepository
            .createQueryBuilder('payment')
            .leftJoinAndSelect('payment.loan', 'loan')
            .leftJoinAndSelect('loan.customer', 'customer')
            .leftJoinAndSelect('payment.createdBy', 'user')
            .where('payment.paymentDate >= :start', { start: startOfMonth })
            .andWhere('payment.paymentDate <= :end', { end: endOfMonth })
            .orderBy('payment.paymentDate', 'DESC')
            .addOrderBy('payment.createdAt', 'DESC')
            .getMany();
        return payments.map((p) => {
            const interestPaid = Number(p.interestPaid || 0);
            const capitalPaid = Number(p.capitalPaid || 0);
            return {
                id: p.id,
                paymentDate: p.paymentDate,
                user: p.createdBy?.fullName || 'Sistema',
                customer: `${p.loan?.customer?.firstName || ''} ${p.loan?.customer?.lastName || ''}`.trim(),
                loanId: p.loan?.id || 0,
                loanType: p.loan?.loanType || '',
                interestPaid,
                capitalPaid,
                total: interestPaid + capitalPaid,
            };
        });
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