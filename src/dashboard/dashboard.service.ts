import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Loan, LoanStatus } from '../loans/entities/loan.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Decimal } from 'decimal.js';

export interface DashboardStats {
  // Métricas principales
  dineroRestado: number;        // Total de dinero prestado
  capitalRecuperado: number;    // Capital que ya regresó
  interesRecabado: number;      // Total de intereses cobrados
  capitalEnTransito: number;    // Capital que aún está prestado
  intersesMensual: number;      // Intereses del mes actual
  
  // Métricas de morosidad
  prestamosVencidos: number;    // Cantidad de préstamos sin pagar
  montoVencido: number;         // Monto total de préstamos sin pagar
  
  // Métricas generales
  totalPrestamos: number;
  prestamosActivos: number;
  prestamosCompletados: number;
  
  // Listas detalladas
  prestamosVencidosDetalle: any[];
  prestamosPorVencer: any[];
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Loan)
    private loansRepository: Repository<Loan>,
    @InjectRepository(Payment)
    private paymentsRepository: Repository<Payment>,
  ) {}

  async getDashboardStats(): Promise<DashboardStats> {
    // Obtener todos los préstamos con sus relaciones
    const loans = await this.loansRepository.find({
      relations: ['customer', 'payments', 'monthlyPayments'],
      order: { loanDate: 'DESC' },
    });

    // Inicializar métricas
    let dineroRestado = 0;
    let capitalRecuperado = 0;
    let interesRecabado = 0;
    let capitalEnTransito = 0;
    let prestamosVencidos = 0;
    let montoVencido = 0;

    const prestamosVencidosDetalle: any[] = [];
    const prestamosPorVencer: any[] = [];

    // Calcular métricas por préstamo
    for (const loan of loans) {
      // Dinero prestado (total acumulado)
      dineroRestado += Number(loan.amount);
      
      // Capital recuperado (lo que ya pagaron al capital)
      capitalRecuperado += Number(loan.totalCapitalPaid || 0);
      
      // Interés recabado (total de intereses cobrados)
      interesRecabado += Number(loan.totalInterestPaid || 0);
      
      // Capital en tránsito (saldo pendiente de préstamos activos)
      if (loan.status === LoanStatus.ACTIVE) {
        capitalEnTransito += Number(loan.currentBalance || 0);
      }

      // Verificar si está vencido (no ha pagado este mes)
      const isOverdue = this.isLoanOverdue(loan);
      if (isOverdue && loan.status === LoanStatus.ACTIVE) {
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

      // Préstamos que vencen pronto (próximos 7 días)
      if (loan.status === LoanStatus.ACTIVE && !isOverdue) {
        const daysSinceLastPayment = this.getDaysSinceLastPayment(loan.lastPaymentDate);
        if (daysSinceLastPayment >= 23) { // Cerca de los 30 días
          prestamosPorVencer.push({
            id: loan.id,
            customer: `${loan.customer?.firstName} ${loan.customer?.lastName}`,
            currentBalance: loan.currentBalance,
                      monthlyPayment: new Decimal(loan.currentBalance || 0).times(0.05).toNumber(),
            daysSinceLastPayment,
          });
        }
      }
    }

    // Calcular interés mensual (del mes actual)
    const intersesMensual = await this.getMonthlyInterest();

    // Contar préstamos por estado
    const prestamosActivos = loans.filter(l => l.status === LoanStatus.ACTIVE).length;
    const prestamosCompletados = loans.filter(l => l.status === LoanStatus.PAID).length;

    return {
      dineroRestado,
      capitalRecuperado,
      interesRecabado,
      capitalEnTransito,
      intersesMensual,
      prestamosVencidos,
      montoVencido,
      totalPrestamos: loans.length,
      prestamosActivos,
      prestamosCompletados,
      prestamosVencidosDetalle: prestamosVencidosDetalle.sort((a, b) => b.daysSinceLastPayment - a.daysSinceLastPayment),
      prestamosPorVencer: prestamosPorVencer.sort((a, b) => b.daysSinceLastPayment - a.daysSinceLastPayment),
    };
  }

  private async getMonthlyInterest(): Promise<number> {
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

  private isLoanOverdue(loan: Loan): boolean {
    if (!loan.lastPaymentDate) {
      // Si nunca ha pagado, verificar si han pasado más de 30 días desde el préstamo
      const daysSinceLoan = this.getDaysSinceDate(loan.loanDate);
      return daysSinceLoan > 30;
    }

    // Si ya pagó antes, verificar si han pasado más de 30 días desde el último pago
    const daysSinceLastPayment = this.getDaysSinceLastPayment(loan.lastPaymentDate);
    return daysSinceLastPayment > 30;
  }

  private getDaysSinceLastPayment(lastPaymentDate: Date | null): number {
    if (!lastPaymentDate) return 0;
    return this.getDaysSinceDate(lastPaymentDate);
  }

  private getDaysSinceDate(date: Date): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - new Date(date).getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  async getLoansWithPaymentStatus(): Promise<any[]> {
    const loans = await this.loansRepository.find({
      relations: ['customer', 'payments'],
      order: { loanDate: 'DESC' },
    });

    return loans.map(loan => {
      const isOverdue = this.isLoanOverdue(loan);
      const hasPaidThisMonth = this.hasPaidThisMonth(loan);
      
      return {
        ...loan,
        paymentStatus: {
          isOverdue,
          hasPaidThisMonth,
          daysSinceLastPayment: this.getDaysSinceLastPayment(loan.lastPaymentDate),
          monthlyPayment: new Decimal(loan.currentBalance || 0).times(0.05).toNumber(),
          status: isOverdue ? 'overdue' : (hasPaidThisMonth ? 'current' : 'pending')
        }
      };
    });
  }

  private hasPaidThisMonth(loan: Loan): boolean {
    if (!loan.lastPaymentDate) return false;
    
    const now = new Date();
    const lastPayment = new Date(loan.lastPaymentDate);
    
    return lastPayment.getMonth() === now.getMonth() && 
           lastPayment.getFullYear() === now.getFullYear();
  }
}
