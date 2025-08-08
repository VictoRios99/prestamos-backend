import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull, EntityManager } from 'typeorm';
import { Loan, LoanStatus } from './entities/loan.entity';
import { MonthlyPayment } from './entities/monthly-payment.entity';
import { CreateLoanDto } from './dto/create-loan.dto';
import { CashMovementsService } from '../cash-movements/cash-movements.service';
import { MovementType } from '../cash-movements/entities/cash-movement.entity';
import { Decimal } from 'decimal.js';

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
    return this.entityManager.transaction(async (transactionalEntityManager) => {
      const { amount, customerId } = createLoanDto;

      const loan = transactionalEntityManager.create(Loan, {
        ...createLoanDto,
        currentBalance: amount.toString(), // Ensure it's a string
        monthlyInterestRate: createLoanDto.monthlyInterestRate || '5', // Use DTO value or default
        customer: { id: customerId },
        createdBy: { id: userId },
      });

      console.log('Objeto Loan a guardar:', loan); // Added log

      const savedLoan = await transactionalEntityManager.save(loan);

      await this.createMonthlyPayment(savedLoan, transactionalEntityManager);

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
    });
  }

  async findOne(id: number, manager?: EntityManager): Promise<Loan> {
    const repository = manager ? manager.getRepository(Loan) : this.loansRepository;
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

  private async createMonthlyPayment(loan: Loan, manager: EntityManager): Promise<MonthlyPayment> {
    const dueDate = new Date(loan.loanDate);
    dueDate.setMonth(dueDate.getMonth() + loan.monthsPaid + 1);

    const expectedAmount = new Decimal(loan.currentBalance).times(0.05);

    const monthlyPayment = manager.create(MonthlyPayment, {
      loan,
      dueDate,
      expectedAmount: expectedAmount.toString(),
      isPaid: false,
    });

    return manager.save(monthlyPayment);
  }

  async findAll(): Promise<Loan[]> {
    const loans = await this.loansRepository.find({
      relations: ['customer', 'payments', 'monthlyPayments'],
      order: { loanDate: 'DESC' },
    });

    for (const loan of loans) {
      if (loan.status === LoanStatus.ACTIVE) {
        const overduePayments = loan.monthlyPayments.filter(
          mp => !mp.isPaid && new Date(mp.dueDate) < new Date()
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
      throw new NotFoundException(`Préstamo con ID ${loanId} no encontrado`);
    }

    return {
      ...loan,
      monthlyPaymentAmount: new Decimal(loan.currentBalance).times(0.05).toString(),
      paymentHistory: loan.monthlyPayments
        .filter(mp => mp.isPaid)
        .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()),
    };
  }

  async getOverdueLoans(): Promise<{
    count: number;
    totalAmount: number;
    loans: Loan[];
  }> {
    const currentDate = new Date();
    const thirtyDaysAgo = new Date(currentDate.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    const overdueLoans = await this.loansRepository
      .createQueryBuilder('loan')
      .leftJoin('loan.customer', 'customer')
      .where('loan.status = :status', { status: LoanStatus.ACTIVE })
      .andWhere('loan.currentBalance > 0')
      .andWhere(
        '(loan.lastPaymentDate IS NULL AND loan.loanDate < :thirtyDaysAgo) OR (loan.lastPaymentDate IS NOT NULL AND loan.lastPaymentDate < :thirtyDaysAgo)',
        { thirtyDaysAgo }
      )
      .select(['loan', 'customer.firstName', 'customer.lastName'])
      .getMany();

    const totalAmount = overdueLoans.reduce((sum, loan) => new Decimal(sum).plus(new Decimal(loan.currentBalance || 0)).toNumber(), 0);

    return {
      count: overdueLoans.length,
      totalAmount,
      loans: overdueLoans,
    };
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
      capitalRecovered = capitalRecovered.plus(new Decimal(loan.totalCapitalPaid));
      interestCollected = interestCollected.plus(new Decimal(loan.totalInterestPaid));
      
      if (loan.status === LoanStatus.ACTIVE) {
        capitalInTransit = capitalInTransit.plus(new Decimal(loan.currentBalance));
      }

      const currentMonthPayments = loan.monthlyPayments.filter(mp => {
        const paymentDate = new Date(mp.paymentDate);
        return mp.isPaid && 
               paymentDate.getMonth() === currentMonth && 
               paymentDate.getFullYear() === currentYear;
      });

      for (const payment of currentMonthPayments) {
        monthlyInterest = monthlyInterest.plus(new Decimal(payment.interestPaid));
      }

      const hasOverduePayments = loan.monthlyPayments.some(
        mp => !mp.isPaid && new Date(mp.dueDate) < new Date()
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
      activeLoans: loans.filter(l => l.status === LoanStatus.ACTIVE).length,
      totalLoans: loans.length,
    };
  }

  async findOverdueLoans(): Promise<Loan[]> {
    const loans = await this.loansRepository.find({
      where: {
        status: LoanStatus.ACTIVE,
      },
      relations: ['customer', 'monthlyPayments'],
    });
  
    return loans.filter(loan => {
      return loan.monthlyPayments.some(
        mp => !mp.isPaid && new Date(mp.dueDate) < new Date()
      );
    });
  }
}
