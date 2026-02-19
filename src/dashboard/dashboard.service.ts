import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Loan, LoanStatus } from '../loans/entities/loan.entity';
import { Payment } from '../payments/entities/payment.entity';

export interface DashboardStats {
  // Métricas principales
  dineroRestado: number; // Total de dinero prestado
  capitalRecuperado: number; // Capital que ya regresó
  interesRecabado: number; // Total de intereses cobrados
  cargosExtrasRecaudados: number; // Total de cargos extras cobrados
  capitalEnTransito: number; // Capital que aún está prestado
  intersesMensual: number; // Intereses del mes actual

  // Métricas de morosidad
  prestamosVencidos: number; // Cantidad de préstamos sin pagar
  montoVencido: number; // Monto total de préstamos sin pagar

  // Métricas generales
  totalPrestamos: number;
  prestamosActivos: number;
  prestamosCompletados: number;

  // Métricas por tipo de préstamo
  totalRecaudadoCapsula: number; // Total recaudado de préstamos tipo cápsula
  totalRecaudadoIndefinido: number; // Total recaudado de préstamos tipo indefinido

  // Desglose de interés esperado del mes actual
  interesEsperadoCapsula: number;
  interesEsperadoIndefinido: number;
  interesEsperadoExtras: number;
  interesEsperadoTotal: number;

  // Progreso de capital Cápsula del mes
  capitalEsperadoCapsula: number;
  capitalRecibidoCapsula: number;

  // Timeline de pagos del mes
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
    let cargosExtrasRecaudados = 0;
    let capitalEnTransito = 0;
    let prestamosVencidos = 0;
    let montoVencido = 0;
    let totalRecaudadoCapsula = 0;
    let totalRecaudadoIndefinido = 0;

    // Métricas mensuales nuevas
    let interesEsperadoCapsula = 0;
    let interesEsperadoIndefinido = 0;
    const interesEsperadoExtras = 0;
    let capitalEsperadoCapsula = 0;
    let capitalRecibidoCapsula = 0;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const prestamosVencidosDetalle: any[] = [];
    const prestamosPorVencer: any[] = [];

    // Semáforo de pagos del mes
    const pagosAlDia: DashboardStats['pagosAlDia'] = [];
    const pagosPendientes: DashboardStats['pagosPendientes'] = [];
    const pagosMorosos: DashboardStats['pagosMorosos'] = [];

    // Calcular métricas por préstamo
    for (const loan of loans) {
      // Dinero prestado (total acumulado)
      dineroRestado += Number(loan.amount);

      // Capital recuperado (lo que ya pagaron al capital)
      capitalRecuperado += Number(loan.totalCapitalPaid || 0);

      // Interés recabado (total de intereses cobrados)
      interesRecabado += Number(loan.totalInterestPaid || 0);

      // Cargos extras recaudados (no se están utilizando actualmente)
      // if (loan.payments && loan.payments.length > 0) {
      //   for (const payment of loan.payments) {
      //     cargosExtrasRecaudados += Number(payment.lateInterest || 0);
      //   }
      // }

      // Total recaudado por tipo de préstamo (capital + interés)
      const totalRecaudadoLoan =
        Number(loan.totalCapitalPaid || 0) +
        Number(loan.totalInterestPaid || 0);

      if (loan.loanType === 'Cápsula') {
        totalRecaudadoCapsula += totalRecaudadoLoan;
      } else if (loan.loanType === 'Indefinido') {
        totalRecaudadoIndefinido += totalRecaudadoLoan;
      }

      // Capital en tránsito (capital real pendiente, sin interés futuro)
      // Para Cápsula: currentBalance incluye interés futuro, así que usamos amount - totalCapitalPaid
      // Para Indefinido: currentBalance = solo capital, pero usamos la misma fórmula por consistencia
      if (loan.status === LoanStatus.ACTIVE || loan.status === LoanStatus.OVERDUE) {
        capitalEnTransito += Math.max(0, Number(loan.amount) - Number(loan.totalCapitalPaid || 0));
      }

      // Verificar si está vencido (>30 días sin pagar o status OVERDUE)
      const isOverdue = this.isLoanOverdue(loan);
      if (
        (isOverdue && loan.status === LoanStatus.ACTIVE) ||
        loan.status === LoanStatus.OVERDUE
      ) {
        prestamosVencidos++;
        montoVencido += Number(loan.currentBalance || 0);

        prestamosVencidosDetalle.push({
          id: loan.id,
          customer: `${loan.customer?.firstName} ${loan.customer?.lastName}`,
          amount: loan.amount,
          currentBalance: loan.currentBalance,
          lastPaymentDate: loan.lastPaymentDate,
          monthsPaid: loan.monthsPaid,
          daysSinceLastPayment: this.getDaysSinceLastPayment(
            loan.lastPaymentDate,
          ),
        });
      }

      // Préstamos que vencen pronto (próximos 7 días)
      if (loan.status === LoanStatus.ACTIVE && !isOverdue) {
        const daysSinceLastPayment = this.getDaysSinceLastPayment(
          loan.lastPaymentDate,
        );
        if (daysSinceLastPayment >= 23) {
          // Cerca de los 30 días
          prestamosPorVencer.push({
            id: loan.id,
            customer: `${loan.customer?.firstName} ${loan.customer?.lastName}`,
            currentBalance: loan.currentBalance,
            monthlyPayment: Math.ceil((loan.currentBalance || 0) * 0.05),
            daysSinceLastPayment,
          });
        }
      }

      // Clasificar estado de pago del mes (solo préstamos activos/vencidos)
      if (
        loan.status === LoanStatus.ACTIVE ||
        loan.status === LoanStatus.OVERDUE
      ) {
        const customerName = `${loan.customer?.firstName || ''} ${loan.customer?.lastName || ''}`.trim();
        const daysSince = this.getDaysSinceLastPayment(loan.lastPaymentDate);

        if (isOverdue || loan.status === LoanStatus.OVERDUE) {
          const diasAtraso = loan.lastPaymentDate
            ? Math.max(0, daysSince - 30)
            : Math.max(0, this.getDaysSinceDate(loan.loanDate) - 30);
          const mesesDeuda = Math.max(1, Math.ceil(diasAtraso / 30));
          const diaEsperado = this.getExpectedPaymentDay(loan, now);
          pagosMorosos.push({
            id: loan.id,
            customer: customerName,
            phone: loan.customer?.phone || '',
            monto: Number(loan.currentBalance || 0),
            diasAtraso,
            loanType: loan.loanType || '',
            mesesDeuda,
            diaEsperado,
          });
        } else if (this.hasPaidThisMonth(loan)) {
          const diaPago = loan.lastPaymentDate
            ? new Date(loan.lastPaymentDate).getDate()
            : now.getDate();
          pagosAlDia.push({
            id: loan.id,
            customer: customerName,
            phone: loan.customer?.phone || '',
            monto: Number(loan.currentBalance || 0),
            loanType: loan.loanType || '',
            diaPago,
          });
        } else {
          const diasRestantes = Math.max(0, 30 - daysSince);
          const diaEsperado = this.getExpectedPaymentDay(loan, now);
          pagosPendientes.push({
            id: loan.id,
            customer: customerName,
            phone: loan.customer?.phone || '',
            monto: Number(loan.currentBalance || 0),
            diasRestantes,
            loanType: loan.loanType || '',
            diaEsperado,
          });
        }
      }

      // Calcular interés esperado y capital del mes actual (solo préstamos activos/vencidos)
      if (
        loan.status === LoanStatus.ACTIVE ||
        loan.status === LoanStatus.OVERDUE
      ) {
        const rate = Number(loan.monthlyInterestRate || 0) / 100;

        if (loan.loanType === 'Cápsula' && loan.monthlyPayments) {
          // Para Cápsula: buscar monthly_payments con dueDate en el mes actual
          for (const mp of loan.monthlyPayments) {
            const dueDate = new Date(mp.dueDate);
            if (
              dueDate.getMonth() === currentMonth &&
              dueDate.getFullYear() === currentYear
            ) {
              // Interés esperado por periodo
              const effectiveRate =
                loan.modality === 'quincenas' ? rate / 2 : rate;
              const interesEsperado = Math.ceil(
                Number(loan.amount) * effectiveRate,
              );
              interesEsperadoCapsula += interesEsperado;

              // Capital esperado = monto esperado del periodo - interés esperado
              const capitalEsperado = Math.max(
                0,
                Number(mp.expectedAmount) - interesEsperado,
              );
              capitalEsperadoCapsula += capitalEsperado;

              // Si ya pagó, sumar al capital recibido
              if (mp.isPaid) {
                capitalRecibidoCapsula += Number(mp.capitalPaid || 0);
              }
            }
          }
        } else if (loan.loanType === 'Indefinido') {
          // Para Indefinido: interés = currentBalance * tasa mensual
          interesEsperadoIndefinido += Math.ceil(
            Number(loan.currentBalance || 0) * rate,
          );
        }
      }
    }

    // Calcular interés mensual (del mes actual)
    const intersesMensual = await this.getMonthlyInterest();

    // Contar préstamos por estado (mutuamente excluyente con prestamosVencidos)
    const prestamosActivos = loans.filter(
      (l) => l.status === LoanStatus.ACTIVE && !this.isLoanOverdue(l),
    ).length;
    const prestamosCompletados = loans.filter(
      (l) => l.status === LoanStatus.PAID,
    ).length;

    const interesEsperadoTotal =
      interesEsperadoCapsula + interesEsperadoIndefinido + interesEsperadoExtras;

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
      interesEsperadoCapsula,
      interesEsperadoIndefinido,
      interesEsperadoExtras,
      interesEsperadoTotal,
      capitalEsperadoCapsula,
      capitalRecibidoCapsula,
      pagosAlDia,
      pagosPendientes: pagosPendientes.sort(
        (a, b) => a.diasRestantes - b.diasRestantes,
      ),
      pagosMorosos: pagosMorosos.sort(
        (a, b) => b.diasAtraso - a.diasAtraso,
      ),
      prestamosVencidosDetalle: prestamosVencidosDetalle.sort(
        (a, b) => b.daysSinceLastPayment - a.daysSinceLastPayment,
      ),
      prestamosPorVencer: prestamosPorVencer.sort(
        (a, b) => b.daysSinceLastPayment - a.daysSinceLastPayment,
      ),
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

    return payments.reduce(
      (total, payment) => total + Number(payment.interestPaid || 0),
      0,
    );
  }

  private isLoanOverdue(loan: Loan): boolean {
    if (!loan.lastPaymentDate) {
      // Si nunca ha pagado, verificar si han pasado más de 30 días desde el préstamo
      const daysSinceLoan = this.getDaysSinceDate(loan.loanDate);
      return daysSinceLoan > 30;
    }

    // Si ya pagó antes, verificar si han pasado más de 30 días desde el último pago
    const daysSinceLastPayment = this.getDaysSinceLastPayment(
      loan.lastPaymentDate,
    );
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

    return loans.map((loan) => {
      const isOverdue = this.isLoanOverdue(loan);
      const hasPaidThisMonth = this.hasPaidThisMonth(loan);

      return {
        ...loan,
        paymentStatus: {
          isOverdue,
          hasPaidThisMonth,
          daysSinceLastPayment: this.getDaysSinceLastPayment(
            loan.lastPaymentDate,
          ),
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

  private getExpectedPaymentDay(loan: Loan, now: Date): number {
    // Try to find the next monthly_payment dueDate in current month
    if (loan.monthlyPayments && loan.monthlyPayments.length > 0) {
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      for (const mp of loan.monthlyPayments) {
        const dueDate = new Date(mp.dueDate);
        if (
          dueDate.getMonth() === currentMonth &&
          dueDate.getFullYear() === currentYear &&
          !mp.isPaid
        ) {
          return dueDate.getDate();
        }
      }
    }
    // Fallback: estimate from last payment + 30 days
    if (loan.lastPaymentDate) {
      const estimated = new Date(loan.lastPaymentDate);
      estimated.setDate(estimated.getDate() + 30);
      const lastDay = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
      ).getDate();
      return Math.min(estimated.getDate(), lastDay);
    }
    // Final fallback: last day of month
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  }

  private hasPaidThisMonth(loan: Loan): boolean {
    if (!loan.lastPaymentDate) return false;

    const now = new Date();
    const lastPayment = new Date(loan.lastPaymentDate);

    return (
      lastPayment.getMonth() === now.getMonth() &&
      lastPayment.getFullYear() === now.getFullYear()
    );
  }
}
