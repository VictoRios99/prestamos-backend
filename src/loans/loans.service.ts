import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Loan, LoanStatus } from './entities/loan.entity';
import { MonthlyPayment } from './entities/monthly-payment.entity';
import { CreateLoanDto } from './dto/create-loan.dto';
import { CashMovementsService } from '../cash-movements/cash-movements.service';
import { MovementType } from '../cash-movements/entities/cash-movement.entity';
import { Decimal } from 'decimal.js';

function getLastDayOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
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
          currentBalance: (
            createLoanDto.totalToPay || createLoanDto.amount
          ).toString(),
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
          new Decimal(amount).toNumber(),
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
    const monthlyInterestRate = new Decimal(loan.monthlyInterestRate).div(100);
    const loanAmount = new Decimal(loan.amount);
    let numPayments: number;
    let expectedAmount: Decimal;
    let totalToPay: Decimal; // New variable for total to pay

    const monthlyPaymentsToSave: MonthlyPayment[] = [];

    if (loan.loanType === 'Cápsula') {
      if (!loan.term) {
        throw new BadRequestException(
          'El plazo (term) es requerido para préstamos tipo Cápsula.',
        ) as any;
      }
      if (loan.modality === 'quincenas') {
        const numberOfMonths = new Decimal(loan.term).div(2);
        totalToPay = (loanAmount.times(monthlyInterestRate).times(numberOfMonths)).plus(loanAmount);
        numPayments = loan.term;
      } else { // Mensual
        // Your formula for Mensual
        // total a pagar = ((monto del prestamo * interes * plazos) + monto del prestamo)
        totalToPay = (loanAmount.times(monthlyInterestRate).times(new Decimal(loan.term))).plus(loanAmount);
        numPayments = loan.term; // Total number of monthly payments
      }
      expectedAmount = totalToPay.div(numPayments); // Divide total to pay by number of payments
    } else if (loan.loanType === 'Indefinido') {
      numPayments = 60; // Project for 5 years for indefinite loans
      expectedAmount = loanAmount.times(monthlyInterestRate); // Interest only, matches your formula
    } else {
      throw new BadRequestException(
        'Tipo de préstamo no soportado para la generación de pagos.',
      ) as any;
    }

    const currentDueDate = new Date(loan.loanDate);
    let lastDueDateWas15th = false; // For Quincenal logic

    for (let i = 0; i < numPayments; i++) {
      let dueDate: Date;

      if (loan.loanType === 'Cápsula' && loan.modality === 'quincenas') {
        if (i === 0) {
          // First payment date
          if (currentDueDate.getDate() <= 15) {
            dueDate = new Date(
              currentDueDate.getFullYear(),
              currentDueDate.getMonth(),
              15,
            );
            lastDueDateWas15th = true;
          } else {
            dueDate = getLastDayOfMonth(currentDueDate);
            lastDueDateWas15th = false;
          }
        } else {
          if (lastDueDateWas15th) {
            dueDate = getLastDayOfMonth(currentDueDate);
            lastDueDateWas15th = false;
            // No need to advance month, as it's still the same month
          } else {
            // Previous was end of month, next is 15th of next month
            currentDueDate.setMonth(currentDueDate.getMonth() + 1);
            dueDate = new Date(
              currentDueDate.getFullYear(),
              currentDueDate.getMonth(),
              15,
            );
            lastDueDateWas15th = true;
          }
        }
      } else {
        // Cápsula Mensual or Indefinido Mensual
        if (i > 0) {
          currentDueDate.setMonth(currentDueDate.getMonth() + 1);
        }
        dueDate = getLastDayOfMonth(currentDueDate);
      }

      const monthlyPayment = manager.create(MonthlyPayment, {
        loan,
        dueDate,
        expectedAmount: expectedAmount.toFixed(2), // Round to 2 decimal places
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

    for (const loan of loans) {
      if (loan.status === LoanStatus.ACTIVE) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const overduePayments = loan.monthlyPayments.filter(
          (mp) => {
            const dueDate = new Date(mp.dueDate);
            const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
            return !mp.isPaid && dueDateOnly < today;
          }
        );
        if (overduePayments.length > 0) {
          loan.status = LoanStatus.OVERDUE;
        }
      }
    }

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
    let accumulatedOverdueAmount = new Decimal(0);
    let overduePeriodsCount = 0; // New variable for overdue periods count

    if (loan.monthlyPayments && loan.monthlyPayments.length > 0) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      for (const mp of loan.monthlyPayments) {
        const dueDate = new Date(mp.dueDate);
        const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        if (!mp.isPaid && dueDateOnly < today) {
          accumulatedOverdueAmount = accumulatedOverdueAmount.plus(new Decimal(mp.expectedAmount));
          overduePeriodsCount++; // Increment count for each overdue period
        }
      }
    }

    return {
      ...loan,
      monthlyPaymentAmount: new Decimal(loan.currentBalance)
        .times(new Decimal(loan.monthlyInterestRate).div(100))
        .toString(),
      paymentHistory: loan.monthlyPayments
        .filter((mp) => mp.isPaid)
        .sort(
          (a, b) =>
            new Date(b.paymentDate).getTime() -
            new Date(a.paymentDate).getTime(),
        ),
      accumulatedOverdueAmount: accumulatedOverdueAmount.toFixed(2),
      overduePeriodsCount: overduePeriodsCount, // Add this new field
      overduePeriodsUnit: loan.modality === 'quincenas' ? 'quincenas' : 'meses', // Add unit
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
      (sum, loan) =>
        new Decimal(sum).plus(new Decimal(loan.currentBalance || 0)).toNumber(),
      0,
    );

    return {
      count: overdueLoans.length,
      totalAmount,
      loans: overdueLoans,
    };
  }

  async getCompletedLoans(): Promise<Loan[]> {
    try {
      const completedLoans = await this.loansRepository.find({
        where: {
          status: LoanStatus.PAID,
        },
        relations: ['customer'], // Only need customer for display in the list
        order: { loanDate: 'DESC' },
      });
      return completedLoans;
    } catch (error) {
      console.error('Error in getCompletedLoans:', error);
      throw error; // Re-throw the error so it propagates to the controller
    }
  }

  async getDashboardStats(): Promise<any> {
    const loans = await this.loansRepository.find({
      relations: ['monthlyPayments'],
    });

    let totalLoaned = new Decimal(0);
    let capitalRecovered = new Decimal(0);
    let interestCollected = new Decimal(0);
    let capitalInTransit = new Decimal(0);
    let overdueCount = 0;
    let overdueAmount = new Decimal(0);

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    let monthlyInterest = new Decimal(0);

    for (const loan of loans) {
      totalLoaned = totalLoaned.plus(new Decimal(loan.amount));
      capitalRecovered = capitalRecovered.plus(
        new Decimal(loan.totalCapitalPaid),
      );
      interestCollected = interestCollected.plus(
        new Decimal(loan.totalInterestPaid),
      );

      if (loan.status === LoanStatus.ACTIVE) {
        capitalInTransit = capitalInTransit.plus(
          new Decimal(loan.currentBalance),
        );
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
        monthlyInterest = monthlyInterest.plus(
          new Decimal(payment.interestPaid),
        );
      }

      const hasOverduePayments = loan.monthlyPayments.some(
        (mp) => !mp.isPaid && new Date(mp.dueDate) < new Date(),
      );

      if (hasOverduePayments) {
        overdueCount++;
        overdueAmount = overdueAmount.plus(new Decimal(loan.currentBalance));
      }
    }

    return {
      totalLoaned: totalLoaned.toNumber(),
      capitalRecovered: capitalRecovered.toNumber(),
      interestCollected: interestCollected.toNumber(),
      capitalInTransit: capitalInTransit.toNumber(),
      monthlyInterest: monthlyInterest.toNumber(),
      overdueCount,
      overdueAmount: overdueAmount.toNumber(),
      activeLoans: loans.filter((l) => l.status === LoanStatus.ACTIVE).length,
      totalLoans: loans.length,
    };
  }
}
