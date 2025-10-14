import { Repository } from 'typeorm';
import { Loan } from '../loans/entities/loan.entity';
import { Payment } from '../payments/entities/payment.entity';
export interface DashboardStats {
    dineroRestado: number;
    capitalRecuperado: number;
    interesRecabado: number;
    cargosExtrasRecaudados: number;
    capitalEnTransito: number;
    intersesMensual: number;
    prestamosVencidos: number;
    montoVencido: number;
    totalPrestamos: number;
    prestamosActivos: number;
    prestamosCompletados: number;
    totalRecaudadoCapsula: number;
    totalRecaudadoIndefinido: number;
    prestamosVencidosDetalle: any[];
    prestamosPorVencer: any[];
}
export declare class DashboardService {
    private loansRepository;
    private paymentsRepository;
    constructor(loansRepository: Repository<Loan>, paymentsRepository: Repository<Payment>);
    getDashboardStats(): Promise<DashboardStats>;
    private getMonthlyInterest;
    private isLoanOverdue;
    private getDaysSinceLastPayment;
    private getDaysSinceDate;
    getLoansWithPaymentStatus(): Promise<any[]>;
    private hasPaidThisMonth;
}
