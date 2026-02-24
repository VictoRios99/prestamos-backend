import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Loan, LoanStatus } from './entities/loan.entity';
import { MonthlyPayment } from './entities/monthly-payment.entity';
import { CreateLoanDto } from './dto/create-loan.dto';
import { CashMovementsService } from '../cash-movements/cash-movements.service';
import { MovementType } from '../cash-movements/entities/cash-movement.entity';

function getLastDayOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/** Redondea a 2 decimales (sin redondear hacia arriba) */
function roundTwo(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Suma exactamente 1 mes calendario, manejando overflow (ej. Jan 30 + 1 = Feb 28) */
function addOneMonth(date: Date): Date {
  const refDay = date.getDate();
  const next = new Date(date.getFullYear(), date.getMonth() + 1, refDay);
  if (next.getDate() !== refDay) {
    return new Date(date.getFullYear(), date.getMonth() + 2, 0);
  }
  return next;
}

/** Cuenta meses completos vencidos desde una fecha de referencia */
function countOverdueMonths(referenceDate: Date, today: Date): number {
  const ref = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  let meses = 0;
  let checkDate = addOneMonth(ref);
  while (checkDate < today) {
    meses++;
    checkDate = addOneMonth(checkDate);
  }
  return meses;
}

@Injectable()
export class LoansService {
  constructor(
    @InjectRepository(Loan)
    private loansRepository: Repository<Loan>,
    @InjectRepository(MonthlyPayment)
    private monthlyPaymentRepository: Repository<MonthlyPayment>,
    private readonly cashMovementsService: CashMovementsService,
    private readonly entityManager: EntityManager,
  ) {}

  async create(createLoanDto: CreateLoanDto, userId: number): Promise<Loan> {
    return this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const { amount, customerId } = createLoanDto;

        const loan = transactionalEntityManager.create(Loan, {
          ...createLoanDto,
          currentBalance: roundTwo(
            createLoanDto.totalToPay || createLoanDto.amount
          ),
          monthlyInterestRate: createLoanDto.monthlyInterestRate || '5',
          term: createLoanDto.term, // Asignar el plazo desde el DTO
          modality: createLoanDto.modality, // Add this line
          customer: { id: customerId },
          createdBy: { id: userId },
        });

        const savedLoan = await transactionalEntityManager.save(loan);

        // Solo crear el plan de pago mensual si el préstamo tiene un plazo definido
        if (savedLoan.term || savedLoan.loanType === 'Indefinido') {
          // Indefinido loans also have monthly payments
          await this.createMonthlyPayment(
            savedLoan,
            transactionalEntityManager,
          );
        }

        await this.cashMovementsService.recordMovement(
          MovementType.LOAN_OUT,
          amount,
          `Préstamo #${savedLoan.id} - Cliente ID: ${customerId}`,
          userId,
          'loan',
          savedLoan.id,
          transactionalEntityManager,
        );

        return savedLoan;
      },
    );
  }

  async findOne(id: number, manager?: EntityManager): Promise<Loan> {
    const repository = manager
      ? manager.getRepository(Loan)
      : this.loansRepository;
    const loan = await repository.findOne({ where: { id } });
    if (!loan) {
      throw new NotFoundException(`Préstamo con ID ${id} no encontrado`);
    }
    return loan;
  }

  async findByCustomer(customerId: number): Promise<Loan[]> {
    return this.loansRepository.find({
      where: { customer: { id: customerId } },
      relations: ['payments', 'monthlyPayments'],
      order: { loanDate: 'DESC' },
    });
  }

  async remove(id: number): Promise<void> {
    const result = await this.loansRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Loan with ID ${id} not found`);
    }
  }

  private async createMonthlyPayment(
    loan: Loan,
    manager: EntityManager,
  ): Promise<void> {
    const monthlyInterestRate = parseFloat(loan.monthlyInterestRate) / 100;
    const loanAmount = loan.amount;
    let numPayments: number;
    let expectedAmount: number;
    let totalToPay: number; // New variable for total to pay

    const monthlyPaymentsToSave: MonthlyPayment[] = [];

    if (loan.loanType === 'Cápsula') {
      if (!loan.term) {
        throw new BadRequestException(
          'El plazo (term) es requerido para préstamos tipo Cápsula.',
        ) as any;
      }
      if (loan.modality === 'quincenas') {
        const numberOfMonths = loan.term / 2;
        const totalToPayTheoretical = roundTwo((loanAmount * monthlyInterestRate * numberOfMonths) + loanAmount);
        numPayments = loan.term;
        expectedAmount = roundTwo(totalToPayTheoretical / numPayments);
        totalToPay = roundTwo(expectedAmount * numPayments);
      } else { // Mensual
        // total a pagar = ((monto del prestamo * interes * plazos) + monto del prestamo)
        const totalToPayTheoretical = roundTwo((loanAmount * monthlyInterestRate * loan.term) + loanAmount);
        numPayments = loan.term;
        expectedAmount = roundTwo(totalToPayTheoretical / numPayments);
        totalToPay = roundTwo(expectedAmount * numPayments);
      }
    } else if (loan.loanType === 'Indefinido') {
      numPayments = 60; // Project for 5 years for indefinite loans
      expectedAmount = roundTwo(loanAmount * monthlyInterestRate); // Interest only
    } else {
      throw new BadRequestException(
        'Tipo de préstamo no soportado para la generación de pagos.',
      ) as any;
    }

    const loanDate = new Date(loan.loanDate);
    const lDay = loanDate.getDate();
    const lMonth = loanDate.getMonth();
    const lYear = loanDate.getFullYear();

    const dueDates: Date[] = [];

    if (loan.modality === 'quincenas') {
      // Quincenas: alternar entre día 15 y fin de mes
      // Si el préstamo se da del 1-15: primer pago = fin de mes (≥15 días)
      // Si el préstamo se da del 16+: primer pago = 15 del siguiente mes (evitar cobro inmediato)
      let curMonth: number, curYear: number, nextIs15: boolean;

      if (lDay <= 15) {
        curMonth = lMonth; curYear = lYear; nextIs15 = false;
      } else {
        curMonth = lMonth + 1; curYear = lYear;
        if (curMonth > 11) { curMonth = 0; curYear++; }
        nextIs15 = true;
      }

      for (let i = 0; i < numPayments; i++) {
        if (nextIs15) {
          dueDates.push(new Date(curYear, curMonth, 15));
          nextIs15 = false;
        } else {
          dueDates.push(new Date(curYear, curMonth + 1, 0)); // último día del mes
          nextIs15 = true;
          curMonth++;
          if (curMonth > 11) { curMonth = 0; curYear++; }
        }
      }
    } else {
      // Mensual (Cápsula o Indefinido): fin de cada mes
      // Si el préstamo se da del 1-15: primer pago = fin de mes actual
      // Si el préstamo se da del 16+: primer pago = fin del mes siguiente
      let startMonth: number, startYear: number;

      if (lDay <= 15) {
        startMonth = lMonth; startYear = lYear;
      } else {
        startMonth = lMonth + 1; startYear = lYear;
        if (startMonth > 11) { startMonth = 0; startYear++; }
      }

      for (let i = 0; i < numPayments; i++) {
        const totalMonths = startMonth + i;
        const yr = startYear + Math.floor(totalMonths / 12);
        const mo = totalMonths % 12;
        dueDates.push(new Date(yr, mo + 1, 0)); // último día del mes
      }
    }

    for (const dueDate of dueDates) {
      const monthlyPayment = manager.create(MonthlyPayment, {
        loan,
        dueDate,
        expectedAmount: expectedAmount,
        isPaid: false,
      });
      monthlyPaymentsToSave.push(monthlyPayment);
    }

    await manager.save(monthlyPaymentsToSave);
  }

  async findAll(): Promise<Loan[]> {
    const loans = await this.loansRepository.find({
      relations: ['customer', 'payments', 'monthlyPayments'],
      order: { loanDate: 'DESC' },
    });

    return loans;
  }

  async getLoanDetails(loanId: number): Promise<any> {
    const loan = await this.loansRepository.findOne({
      where: { id: loanId },
      relations: ['customer', 'payments', 'monthlyPayments'],
    });

    if (!loan) {
      throw new NotFoundException(
        `Préstamo con ID ${loanId} no encontrado` as any,
      );
    }

    // Calculate accumulated overdue amount and overdue periods count
    let accumulatedOverdueAmount = 0;
    let overduePeriodsCount = 0;
    let overduePeriodsUnit = loan.modality === 'quincenas' ? 'quincenas' : 'meses';

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (loan.loanType === 'Indefinido') {
      // Indefinido: calcular meses vencidos desde lastPaymentDate (o loanDate)
      const ref = loan.lastPaymentDate
        ? new Date(loan.lastPaymentDate)
        : new Date(loan.loanDate);
      overduePeriodsCount = countOverdueMonths(ref, today);
      overduePeriodsUnit = 'meses';
      // Adeudo acumulado = meses × interés mensual sobre monto original
      const rate = parseFloat(loan.monthlyInterestRate) / 100;
      accumulatedOverdueAmount = overduePeriodsCount * Math.ceil(Number(loan.amount) * rate);
    } else if (loan.monthlyPayments && loan.monthlyPayments.length > 0) {
      // Cápsula: contar monthly_payments vencidos no pagados
      for (const mp of loan.monthlyPayments) {
        const dueDate = new Date(mp.dueDate);
        const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        if (!mp.isPaid && dueDateOnly < today) {
          accumulatedOverdueAmount += Number(mp.expectedAmount || 0);
          overduePeriodsCount++;
        }
      }

      // Si todos los MPs están pagados pero el préstamo sigue activo/overdue
      // (calendario agotado con saldo pendiente), usar cálculo por tiempo
      if (overduePeriodsCount === 0 && loan.status !== LoanStatus.PAID && loan.status !== LoanStatus.CANCELLED) {
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

    // Calculate payment amount per period based on loan type
    let monthlyPaymentAmount: number;
    const rate = parseFloat(loan.monthlyInterestRate) / 100;
    if (loan.loanType === 'Cápsula' && loan.term) {
      const periodRate = loan.modality === 'quincenas' ? rate / 2 : rate;
      const totalInterest = roundTwo(Number(loan.amount) * periodRate * loan.term);
      monthlyPaymentAmount = roundTwo((Number(loan.amount) + totalInterest) / loan.term);
    } else if (loan.loanType === 'Cápsula' && !loan.term && loan.monthlyPayments?.length > 0) {
      // Cápsula sin plazo explícito: usar expectedAmount del primer MP
      monthlyPaymentAmount = Number(loan.monthlyPayments[0].expectedAmount || 0);
    } else {
      // Indefinido: interest on original amount
      monthlyPaymentAmount = roundTwo(Number(loan.amount) * rate);
    }

    return {
      ...loan,
      monthlyPaymentAmount,
      paymentHistory: loan.monthlyPayments
        .filter((mp) => mp.isPaid)
        .sort(
          (a, b) =>
            new Date(b.paymentDate).getTime() -
            new Date(a.paymentDate).getTime(),
        ),
      accumulatedOverdueAmount: accumulatedOverdueAmount,
      overduePeriodsCount: overduePeriodsCount,
      overduePeriodsUnit: overduePeriodsUnit,
      totalExtraChargesPaid: totalExtraChargesPaid, // Add total extra charges
    };
  }

  async findOverdueLoans(): Promise<{
    count: number;
    totalAmount: number;
    loans: Loan[];
  }> {
    const currentDate = new Date();
    const thirtyDaysAgo = new Date(
      currentDate.getTime() - 30 * 24 * 60 * 60 * 1000,
    );

    const overdueLoans = await this.loansRepository
      .createQueryBuilder('loan')
      .leftJoin('loan.customer', 'customer')
      .where('loan.status = :status', { status: LoanStatus.ACTIVE })
      .andWhere('loan.currentBalance > 0')
      .andWhere(
        '(loan.lastPaymentDate IS NULL AND loan.loanDate < :thirtyDaysAgo) OR (loan.lastPaymentDate IS NOT NULL AND loan.lastPaymentDate < :thirtyDaysAgo)',
        { thirtyDaysAgo },
      )
      .select(['loan', 'customer.firstName', 'customer.lastName'])
      .getMany();

    const totalAmount = overdueLoans.reduce(
      (sum, loan) => sum + (loan.currentBalance || 0),
      0,
    );

    return {
      count: overdueLoans.length,
      totalAmount,
      loans: overdueLoans,
    };
  }

  async updateOverdueStatuses(): Promise<{ markedOverdue: number; restoredActive: number; markedPaid: number }> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    // Paso 1: ACTIVE/OVERDUE con balance <= 0 → PAID (raw SQL para evitar problemas de mapping)
    const paidResult = await this.loansRepository.query(
      `UPDATE loans SET status = 'PAID', updated_at = NOW()
       WHERE status IN ('ACTIVE', 'OVERDUE')
       AND (current_balance <= 0 OR current_balance IS NULL AND total_capital_paid >= amount)`,
    );
    const markedPaid = paidResult[1] || 0;

    // Paso 2: ACTIVE con balance > 0 y >30 días sin pago → OVERDUE
    const overdueResult = await this.loansRepository.query(
      `UPDATE loans SET status = 'OVERDUE', updated_at = NOW()
       WHERE status = 'ACTIVE'
       AND current_balance > 0
       AND (
         (last_payment_date IS NULL AND loan_date < $1)
         OR (last_payment_date IS NOT NULL AND last_payment_date < $1)
       )`,
      [thirtyDaysAgoStr],
    );
    const markedOverdue = overdueResult[1] || 0;

    // Paso 3: OVERDUE con balance > 0 y pago reciente → ACTIVE
    const activeResult = await this.loansRepository.query(
      `UPDATE loans SET status = 'ACTIVE', updated_at = NOW()
       WHERE status = 'OVERDUE'
       AND current_balance > 0
       AND last_payment_date >= $1`,
      [thirtyDaysAgoStr],
    );
    const restoredActive = activeResult[1] || 0;

    return { markedOverdue, restoredActive, markedPaid };
  }

  async getCompletedLoans(): Promise<Loan[]> {
    try {
      const completedLoans = await this.loansRepository.find({
        where: [
          { status: LoanStatus.PAID },
          { status: LoanStatus.CANCELLED },
        ],
        relations: ['customer'],
        order: { loanDate: 'DESC' },
      });
      return completedLoans;
    } catch (error) {
      throw error;
    }
  }

  async getDashboardStats(): Promise<any> {
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

      // Calculate extra charges collected from all payments (no se están utilizando actualmente)
      // if (loan.payments && loan.payments.length > 0) {
      //   for (const payment of loan.payments) {
      //     extraChargesCollected = extraChargesCollected + (payment.lateInterest || 0);
      //   }
      // }

      if (loan.status === LoanStatus.ACTIVE) {
        capitalInTransit = capitalInTransit + loan.currentBalance;
      }

      const currentMonthPayments = loan.monthlyPayments.filter((mp) => {
        const paymentDate = new Date(mp.paymentDate);
        return (
          mp.isPaid &&
          paymentDate.getMonth() === currentMonth &&
          paymentDate.getFullYear() === currentYear
        );
      });

      for (const payment of currentMonthPayments) {
        monthlyInterest = monthlyInterest + payment.interestPaid;
      }

      const hasOverduePayments = loan.monthlyPayments.some(
        (mp) => !mp.isPaid && new Date(mp.dueDate) < new Date(),
      );

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
      activeLoans: loans.filter((l) => l.status === LoanStatus.ACTIVE).length,
      totalLoans: loans.length,
    };
  }
}
