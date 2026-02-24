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
  pagosRecibidosMes: number; // Total de pagos recibidos en el mes actual
  pagosRecibidosMesCapitalCapsula: number;
  pagosRecibidosMesInteresCapsula: number;
  pagosRecibidosMesCapitalIndefinido: number;
  pagosRecibidosMesInteresIndefinido: number;

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
    capitalPendienteMes?: number;
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
    capitalPendienteMes?: number;
  }>;

  // Listas detalladas
  prestamosVencidosDetalle: any[];
  prestamosPorVencer: any[];
}

export interface CapitalDistributionEntry {
  customerId: number;
  customerName: string;
  capitalEnTransito: number;
  percentage: number;
  loanCount: number;
  loans: Array<{ id: number; type: string; capital: number }>;
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

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Loan)
    private loansRepository: Repository<Loan>,
    @InjectRepository(Payment)
    private paymentsRepository: Repository<Payment>,
  ) {}

  /** Parse a 'date' column (no time) into a local-midnight Date, avoiding timezone shift */
  private toLocalDate(d: Date | string | null): Date {
    if (!d) return new Date(0);
    if (typeof d === 'string') {
      const [y, m, day] = d.split('-').map(Number);
      return new Date(y, m - 1, day);
    }
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }

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
    let totalRecaudadoCapsula = 0;
    let totalRecaudadoIndefinido = 0;

    // Métricas mensuales — se acumulan pendientes en el loop, luego se suman con bitácora
    let interesPendienteCapsula = 0;   // Interés de periodos cápsula sin pagar
    let interesPendienteIndefinido = 0; // Interés de indefinidos que no han pagado este mes
    const interesEsperadoExtras = 0;
    let interesEsperadoCapsula = 0;    // Se calcula: bitácora + pendiente
    let interesEsperadoIndefinido = 0; // Se calcula: bitácora + pendiente
    let capitalPendienteCapsula = 0;   // Capital de periodos sin pagar del mes
    let capitalEsperadoCapsula = 0;    // Se calcula: bitácora + pendiente
    let capitalRecibidoCapsula = 0;    // Se asigna desde payments reales (bitácora)

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

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

      // Clasificar estado de pago del mes (solo préstamos activos/vencidos con balance > 0)
      if (
        (loan.status === LoanStatus.ACTIVE ||
        loan.status === LoanStatus.OVERDUE) &&
        Number(loan.currentBalance) > 0
      ) {
        const customerName = `${loan.customer?.firstName || ''} ${loan.customer?.lastName || ''}`.trim();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // --- CÁPSULAS CON CALENDARIO (monthly_payments) ---
        if (loan.loanType === 'Cápsula' && loan.monthlyPayments && loan.monthlyPayments.length > 0) {
          // Buscar TODOS los MPs impagos con fecha vencida (cualquier mes)
          const allUnpaidPastDue = loan.monthlyPayments.filter(
            mp => !mp.isPaid && this.toLocalDate(mp.dueDate) < todayStart,
          );

          if (allUnpaidPastDue.length > 0) {
            // Tiene periodos vencidos sin pagar
            const sorted = allUnpaidPastDue.sort(
              (a, b) => this.toLocalDate(a.dueDate).getTime() - this.toLocalDate(b.dueDate).getTime(),
            );
            const oldestDue = this.toLocalDate(sorted[0].dueDate);
            const diasAtraso = Math.ceil((todayStart.getTime() - oldestDue.getTime()) / 86400000);
            // Solo moroso si el MP más viejo impago tiene > 1 mes de retraso
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
            } else {
              // Menos de 1 mes de retraso → pendiente
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
          } else {
            // Sin MPs vencidos. Buscar próximos MPs pendientes
            const unpaidUpcoming = loan.monthlyPayments.filter(
              mp => !mp.isPaid && this.toLocalDate(mp.dueDate) >= todayStart,
            );

            if (unpaidUpcoming.length > 0) {
              // Tiene MPs futuros sin pagar → pendiente
              const nextDue = unpaidUpcoming.sort(
                (a, b) => this.toLocalDate(a.dueDate).getTime() - this.toLocalDate(b.dueDate).getTime(),
              )[0];
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
            } else {
              // Todos los MPs pagados, calendario completo → al día
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
        // --- PRÉSTAMOS SIN CALENDARIO (Indefinido) ---
        else {
          const nextExpected = this.getNextExpectedDateIndefinido(loan);

          if (todayStart > nextExpected) {
            // Pasó la fecha esperada → moroso
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
          } else if (this.hasPaidThisMonth(loan)) {
            // Pagó este mes y no está vencido → al día
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
          } else {
            // Aún no vence → pendiente
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

      // Calcular interés esperado y capital del mes actual
      // Para Cápsula: usar calendario de monthly_payments
      // Excluir CANCELLED (no se espera dinero de préstamos cancelados)
      if (loan.loanType === 'Cápsula' && loan.monthlyPayments && loan.status !== LoanStatus.CANCELLED) {
        // Periodos de Feb ordenados por dueDate
        const febMps = loan.monthlyPayments
          .filter(mp => {
            const d = this.toLocalDate(mp.dueDate);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
          })
          .sort((a, b) => this.toLocalDate(a.dueDate).getTime() - this.toLocalDate(b.dueDate).getTime());

        let loanCapitalPendiente = 0;
        for (const mp of febMps) {
          const rate = Number(loan.monthlyInterestRate || 0) / 100;
          const effectiveRate =
            loan.modality === 'quincenas' ? rate / 2 : rate;
          const interesEsperado = Math.round(
            Number(loan.amount) * effectiveRate * 100,
          ) / 100;
          // PAID: préstamo liquidado, todos los periodos están cubiertos
          const isPeriodPaid = loan.status === LoanStatus.PAID || mp.isPaid;
          if (!isPeriodPaid) {
            interesPendienteCapsula += interesEsperado;
            const capitalEsperado = Math.max(
              0,
              Number(mp.expectedAmount) - interesEsperado,
            );
            loanCapitalPendiente += capitalEsperado;
          }
        }

        capitalPendienteCapsula += loanCapitalPendiente;

        // Enganchar capitalPendienteMes al timeline (pendientes o morosos)
        if (loanCapitalPendiente > 0) {
          const pe = pagosPendientes.find(p => p.id === loan.id);
          if (pe) pe.capitalPendienteMes = loanCapitalPendiente;
          const mo = pagosMorosos.find(p => p.id === loan.id);
          if (mo) mo.capitalPendienteMes = loanCapitalPendiente;
        }
      } else if (
        loan.loanType === 'Indefinido' &&
        (loan.status === LoanStatus.ACTIVE || loan.status === LoanStatus.OVERDUE)
      ) {
        // Indefinido: solo acumular pendiente de los que NO han pagado este mes
        const rate = Number(loan.monthlyInterestRate || 0) / 100;
        const expectedInterest = Math.round(
          Number(loan.currentBalance || 0) * rate * 100,
        ) / 100;
        if (!this.hasPaidThisMonth(loan)) {
          interesPendienteIndefinido += expectedInterest;
        }
      }
    }

    // Calcular pagos recibidos del mes actual con desglose
    const pagosMes = await this.getMonthlyPaymentsBreakdown();

    // Esperado = Recibido real (bitácora) + Pendiente por cobrar
    // Interés
    interesEsperadoCapsula = pagosMes.interesCapsula + interesPendienteCapsula;
    interesEsperadoIndefinido = pagosMes.interesIndefinido + interesPendienteIndefinido;
    // Capital cápsula
    capitalRecibidoCapsula = pagosMes.capitalCapsula;
    capitalEsperadoCapsula = capitalRecibidoCapsula + capitalPendienteCapsula;

    // Derivar métricas de vencidos y próximos a vencer del timeline
    const prestamosVencidos = pagosMorosos.length;
    const montoVencido = pagosMorosos.reduce((sum, p) => sum + p.monto, 0);

    // Préstamos activos = los que no están morosos ni completados
    const prestamosActivos = pagosAlDia.length + pagosPendientes.length;
    const prestamosCompletados = loans.filter(
      (l) => l.status === LoanStatus.PAID || l.status === LoanStatus.CANCELLED,
    ).length;

    // Próximos a vencer = todos los pendientes
    const prestamosPorVencer = pagosPendientes.map((p) => ({
      id: p.id,
      customer: p.customer,
      currentBalance: p.monto,
      diasRestantes: p.diasRestantes,
      diaEsperado: p.diaEsperado,
    }));

    const interesEsperadoTotal =
      interesEsperadoCapsula + interesEsperadoIndefinido + interesEsperadoExtras;

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
      pagosPendientes: pagosPendientes.sort(
        (a, b) => a.diasRestantes - b.diasRestantes,
      ),
      pagosMorosos: pagosMorosos.sort(
        (a, b) => b.diasAtraso - a.diasAtraso,
      ),
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
      prestamosPorVencer: prestamosPorVencer.sort(
        (a, b) => a.diasRestantes - b.diasRestantes,
      ),
    };
  }

  private async getMonthlyPaymentsBreakdown(): Promise<{
    total: number;
    capitalCapsula: number;
    interesCapsula: number;
    capitalIndefinido: number;
    interesIndefinido: number;
  }> {
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
      } else {
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

  private getDaysSinceDate(date: Date | string): number {
    const now = new Date();
    const parsed = this.toLocalDate(date);
    const diffTime = Math.abs(now.getTime() - parsed.getTime());
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

  /**
   * Suma 1 mes calendario a una fecha, manejando overflow de días.
   * Ej: Jan 30 + 1 mes = Feb 28 (no March 2).
   * Ej: Jan 15 + 1 mes = Feb 15.
   */
  private addOneMonth(date: Date): Date {
    const refDay = date.getDate();
    const next = new Date(date.getFullYear(), date.getMonth() + 1, refDay);
    // Si el día desbordó al mes siguiente (ej: Feb 30 → March 2), usar último día del mes destino
    if (next.getDate() !== refDay) {
      return new Date(date.getFullYear(), date.getMonth() + 2, 0);
    }
    return next;
  }

  /**
   * Calcula la próxima fecha esperada de pago para Indefinido.
   * Usa último pago (o fecha del préstamo) + 1 mes calendario.
   * Ej: último pago 30 Ene → esperado 28 Feb (último día de Feb).
   */
  private getNextExpectedDateIndefinido(loan: Loan): Date {
    const referenceDate = loan.lastPaymentDate
      ? this.toLocalDate(loan.lastPaymentDate)
      : this.toLocalDate(loan.loanDate);
    return this.addOneMonth(referenceDate);
  }

  /**
   * Cuenta cuántos ciclos mensuales ha perdido un préstamo Indefinido.
   */
  private countMissedCyclesIndefinido(loan: Loan, today: Date): number {
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

  private isPaymentExpectedThisMonth(loan: Loan, now: Date): boolean {
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Cápsula: verificar si hay monthlyPayment sin pagar este mes
    if (loan.monthlyPayments && loan.monthlyPayments.length > 0) {
      return loan.monthlyPayments.some((mp) => {
        const dueDate = this.toLocalDate(mp.dueDate);
        return (
          dueDate.getMonth() === currentMonth &&
          dueDate.getFullYear() === currentYear &&
          !mp.isPaid
        );
      });
    }

    // Indefinido: estimar si lastPayment + 30 cae en este mes
    if (loan.lastPaymentDate) {
      const estimated = this.toLocalDate(loan.lastPaymentDate);
      estimated.setDate(estimated.getDate() + 30);
      return (
        estimated.getMonth() === currentMonth &&
        estimated.getFullYear() === currentYear
      );
    }

    // Sin historial de pago: sí se espera este mes
    return true;
  }

  private getExpectedPaymentDay(loan: Loan, now: Date): number {
    // Try to find the next monthly_payment dueDate in current month
    if (loan.monthlyPayments && loan.monthlyPayments.length > 0) {
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      for (const mp of loan.monthlyPayments) {
        const dueDate = this.toLocalDate(mp.dueDate);
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
      const estimated = this.toLocalDate(loan.lastPaymentDate);
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
    const lastPayment = this.toLocalDate(loan.lastPaymentDate);

    return (
      lastPayment.getMonth() === now.getMonth() &&
      lastPayment.getFullYear() === now.getFullYear()
    );
  }

  async getCapitalDistribution(): Promise<CapitalDistributionEntry[]> {
    const loans = await this.loansRepository.find({
      relations: ['customer'],
      where: [
        { status: LoanStatus.ACTIVE },
        { status: LoanStatus.OVERDUE },
      ],
    });

    const customerMap = new Map<
      number,
      { name: string; capital: number; loans: Array<{ id: number; type: string; capital: number; amount: number; status: string }> }
    >();

    for (const loan of loans) {
      const customerId = loan.customer?.id || 0;
      const customerName = `${loan.customer?.firstName || ''} ${loan.customer?.lastName || ''}`.trim();
      const loanCapital = Math.max(0, Number(loan.amount) - Number(loan.totalCapitalPaid || 0));

      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, { name: customerName, capital: 0, loans: [] });
      }
      const entry = customerMap.get(customerId)!;
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

  async getPaymentActivityLog(month: number, year: number): Promise<PaymentLogEntry[]> {
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
        paymentDate: p.paymentDate as unknown as string,
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
}
