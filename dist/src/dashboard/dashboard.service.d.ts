import { Repository } from 'typeorm';
import { Loan } from '../loans/entities/loan.entity';
import { Payment } from '../payments/entities/payment.entity';
export interface DashboardStats {
    dineroRestado: number;
    capitalRecuperado: number;
    interesRecabado: number;
    cargosExtrasRecaudados: number;
    capitalEnTransito: number;
    pagosRecibidosMes: number;
    pagosRecibidosMesCapitalCapsula: number;
    pagosRecibidosMesInteresCapsula: number;
    pagosRecibidosMesCapitalIndefinido: number;
    pagosRecibidosMesInteresIndefinido: number;
    prestamosVencidos: number;
    montoVencido: number;
    totalPrestamos: number;
    prestamosActivos: number;
    prestamosCompletados: number;
    totalRecaudadoCapsula: number;
    totalRecaudadoIndefinido: number;
    interesEsperadoCapsula: number;
    interesEsperadoIndefinido: number;
    interesEsperadoExtras: number;
    interesEsperadoTotal: number;
    capitalEsperadoCapsula: number;
    capitalRecibidoCapsula: number;
    pagosAlDia: Array<{
        id: number;
        customer: string;
        phone: string;
        monto: number;
        loanType: string;
        diaPago: number;
    }>;
    pagosPendientes: Array<{
        id: number;
        customer: string;
        phone: string;
        monto: number;
        diasRestantes: number;
        loanType: string;
        diaEsperado: number;
    }>;
    pagosMorosos: Array<{
        id: number;
        customer: string;
        phone: string;
        monto: number;
        diasAtraso: number;
        loanType: string;
        mesesDeuda: number;
        diaEsperado: number;
    }>;
    prestamosVencidosDetalle: any[];
    prestamosPorVencer: any[];
}
export interface CapitalDistributionEntry {
    customerId: number;
    customerName: string;
    capitalEnTransito: number;
    percentage: number;
    loanCount: number;
    loans: Array<{
        id: number;
        type: string;
        capital: number;
    }>;
}
export interface PaymentLogEntry {
    id: number;
    paymentDate: string;
    user: string;
    customer: string;
    loanId: number;
    loanType: string;
    interestPaid: number;
    capitalPaid: number;
    total: number;
}
export declare class DashboardService {
    private loansRepository;
    private paymentsRepository;
    constructor(loansRepository: Repository<Loan>, paymentsRepository: Repository<Payment>);
    private toLocalDate;
    getDashboardStats(): Promise<DashboardStats>;
    private getMonthlyPaymentsBreakdown;
    private isLoanOverdue;
    private getDaysSinceLastPayment;
    private getDaysSinceDate;
    getLoansWithPaymentStatus(): Promise<any[]>;
    private addOneMonth;
    private getNextExpectedDateIndefinido;
    private countMissedCyclesIndefinido;
    private isPaymentExpectedThisMonth;
    private getExpectedPaymentDay;
    private hasPaidThisMonth;
    getCapitalDistribution(): Promise<CapitalDistributionEntry[]>;
    getPaymentActivityLog(month: number, year: number): Promise<PaymentLogEntry[]>;
}
