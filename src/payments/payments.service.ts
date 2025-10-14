import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, EntityManager } from 'typeorm';
import { Payment, PaymentType } from './entities/payment.entity';
import { Loan, LoanStatus } from '../loans/entities/loan.entity';
import { MonthlyPayment } from '../loans/entities/monthly-payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CashMovementsService } from '../cash-movements/cash-movements.service';
import { MovementType } from '../cash-movements/entities/cash-movement.entity';
import { User } from '../users/entities/user.entity';
import { LoansService } from '../loans/loans.service';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private paymentsRepository: Repository<Payment>,
    private readonly loansService: LoansService,
    private readonly cashMovementsService: CashMovementsService,
    private readonly entityManager: EntityManager,
  ) {}

  async create(
    createPaymentDto: CreatePaymentDto,
    userId: number,
  ): Promise<Payment> {
    const { loanId, paymentDate, paymentMethod, notes, overduePeriodsPaid, lateInterest } = createPaymentDto;

    let totalPaymentReceived: number;
    let actualCapitalPaid: number;
    let actualInterestPaid: number;

    try {
      return await this.entityManager.transaction(
        async (transactionalEntityManager) => {
          await transactionalEntityManager.findOne(Loan, {
            where: { id: loanId },
            lock: { mode: 'pessimistic_write' },
          });
          const loan = await transactionalEntityManager.findOne(Loan, {
            where: { id: loanId },
            relations: ['monthlyPayments'],
          });

          if (!loan) {
            throw new NotFoundException('Préstamo no encontrado');
          }

          if (loan.status !== LoanStatus.ACTIVE && loan.status !== LoanStatus.OVERDUE) {
            throw new BadRequestException(
              'No se puede pagar un préstamo inactivo o pagado',
            );
          }

          const currentBalance = loan.currentBalance;

          if (currentBalance <= 0) {
            throw new BadRequestException(
              'El préstamo ya está pagado completamente',
            );
          }

          if (overduePeriodsPaid && overduePeriodsPaid > 0) {
            // Logic for paying overdue periods for Cápsula loans
            if (loan.loanType !== 'Cápsula') {
              throw new BadRequestException('El pago de periodos vencidos solo está disponible para préstamos tipo Cápsula.');
            }

            const overdueMonthlyPayments = loan.monthlyPayments
              .filter(mp => !mp.isPaid && new Date(mp.dueDate) < new Date())
              .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

            if (overduePeriodsPaid > overdueMonthlyPayments.length) {
              throw new BadRequestException('El número de periodos a pagar excede los periodos vencidos.');
            }

            let totalAmountPaid = 0;
            let totalCapitalPaidFromOverdue = 0;
            let totalInterestPaidFromOverdue = 0;

            for (let i = 0; i < overduePeriodsPaid; i++) {
              const mp = overdueMonthlyPayments[i];
              const expectedAmount = mp.expectedAmount;
              totalAmountPaid = totalAmountPaid + expectedAmount;

              // Calcular interés según modalidad (quincenas o meses)
              const monthlyInterestRate = parseFloat(loan.monthlyInterestRate) / 100;
              let interestRateForPeriod = monthlyInterestRate;

              if (loan.modality === 'quincenas') {
                // Para quincenas, dividir la tasa mensual entre 2
                interestRateForPeriod = monthlyInterestRate / 2;
              }

              const interestForPeriod = Math.ceil(loan.amount * interestRateForPeriod);

              let interestPaidForPeriod: number;
              let capitalPaidForPeriod: number;

              if (expectedAmount > interestForPeriod) {
                interestPaidForPeriod = interestForPeriod;
                capitalPaidForPeriod = expectedAmount - interestForPeriod;
              } else {
                interestPaidForPeriod = expectedAmount;
                capitalPaidForPeriod = 0;
              }

              totalInterestPaidFromOverdue = totalInterestPaidFromOverdue + interestPaidForPeriod;
              totalCapitalPaidFromOverdue = totalCapitalPaidFromOverdue + capitalPaidForPeriod;

              mp.isPaid = true;
              mp.paidAmount = expectedAmount;
              mp.paymentDate = new Date(paymentDate);
              mp.interestPaid = interestPaidForPeriod;
              mp.capitalPaid = capitalPaidForPeriod;
              await transactionalEntityManager.save(MonthlyPayment, mp);
            }

            actualCapitalPaid = totalCapitalPaidFromOverdue;
            actualInterestPaid = totalInterestPaidFromOverdue;
            totalPaymentReceived = totalAmountPaid;

            loan.monthsPaid = (loan.monthsPaid || 0) + overduePeriodsPaid;
            loan.currentBalance = currentBalance - totalPaymentReceived;

          } else {
            // Existing logic for regular payments
            if (createPaymentDto.amount !== undefined && createPaymentDto.amount !== null) {
              totalPaymentReceived = createPaymentDto.amount;
              if (totalPaymentReceived <= 0) {
                throw new BadRequestException('El monto del pago debe ser mayor a 0');
              }

              // Calcular interés según modalidad (quincenas o meses)
              const monthlyInterestRate = parseFloat(loan.monthlyInterestRate) / 100;
              let interestRateForPeriod = monthlyInterestRate;

              if (loan.loanType === 'Cápsula' && loan.modality === 'quincenas') {
                // Para quincenas, dividir la tasa mensual entre 2
                interestRateForPeriod = monthlyInterestRate / 2;
              }

              const interestForPeriod = Math.ceil(loan.amount * interestRateForPeriod);

              if (totalPaymentReceived > interestForPeriod) {
                actualInterestPaid = interestForPeriod;
                actualCapitalPaid = totalPaymentReceived - interestForPeriod;
              } else {
                actualInterestPaid = totalPaymentReceived;
                actualCapitalPaid = 0;
              }

              if (actualCapitalPaid > currentBalance) {
                actualCapitalPaid = currentBalance;
              }
              loan.currentBalance = currentBalance - totalPaymentReceived;
              loan.monthsPaid = (loan.monthsPaid || 0) + 1;

            } else if ((createPaymentDto.capitalAmount !== undefined && createPaymentDto.capitalAmount !== null) || (createPaymentDto.interestAmount !== undefined && createPaymentDto.interestAmount !== null)) {
              actualCapitalPaid = createPaymentDto.capitalAmount || 0;
              actualInterestPaid = createPaymentDto.interestAmount || 0;
              totalPaymentReceived = actualCapitalPaid + actualInterestPaid;

              if (totalPaymentReceived <= 0) {
                throw new BadRequestException('El monto total del pago (capital + interés) debe ser mayor a 0');
              }
              if (actualCapitalPaid > currentBalance) {
                actualCapitalPaid = currentBalance;
              }
              loan.currentBalance = currentBalance - actualCapitalPaid;
            } else {
              throw new BadRequestException('Debe proporcionar un monto de pago válido.');
            }
          }

          loan.totalInterestPaid = loan.totalInterestPaid + actualInterestPaid;
          loan.totalCapitalPaid = loan.totalCapitalPaid + actualCapitalPaid;
          loan.lastPaymentDate = new Date(paymentDate);

          if (loan.currentBalance <= 0) {
            loan.currentBalance = 0;
            loan.status = LoanStatus.PAID;
          }

          await transactionalEntityManager.save(Loan, loan);

          let paymentType: PaymentType = PaymentType.INTEREST;
          if (actualCapitalPaid > 0 && actualInterestPaid > 0) {
            paymentType = PaymentType.BOTH;
          } else if (actualCapitalPaid > 0 && actualInterestPaid === 0) {
            paymentType = PaymentType.CAPITAL;
          }

          const receiptNumber = await this.generateReceiptNumber(transactionalEntityManager);

          const payment = transactionalEntityManager.create(Payment, {
            loan,
            paymentDate: new Date(paymentDate),
            amount: totalPaymentReceived,
            paymentType,
            paymentMethod: paymentMethod ?? 'CASH',
            receiptNumber,
            notes: notes ?? '',
            interestPaid: actualInterestPaid,
            capitalPaid: actualCapitalPaid,
            lateInterest: lateInterest || 0,
            createdBy: { id: userId } as User,
          });

          const savedPayment = await transactionalEntityManager.save(Payment, payment);

          const lateInterestAmount = lateInterest || 0;
          const totalWithLateInterest = totalPaymentReceived + lateInterestAmount;

          await this.cashMovementsService.recordMovement(
            MovementType.PAYMENT_IN,
            totalWithLateInterest,
            `Pago #${savedPayment.id} - Préstamo #${loanId} - Recibo: ${receiptNumber} - Interés: ${actualInterestPaid}, Capital: ${actualCapitalPaid}${lateInterestAmount > 0 ? `, Interés por mora: ${lateInterestAmount}` : ''}`,
            userId,
            'payment',
            savedPayment.id,
            transactionalEntityManager,
          );

          return savedPayment;
        },
      );
    } catch (error) {
      console.log(error);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al procesar el pago. Por favor, intente de nuevo más tarde.');
    }
  }

  private async generateReceiptNumber(manager: EntityManager): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    const startOfMonth = new Date(year, date.getMonth(), 1);
    const endOfMonth = new Date(year, date.getMonth() + 1, 0);

    const count = await manager.count(Payment, {
      where: {
        createdAt: Between(startOfMonth, endOfMonth),
      },
    });

    const sequential = String(count + 1).padStart(4, '0');
    return `REC-${year}${month}-${sequential}`;
  }

  async findAll(): Promise<Payment[]> {
    return this.paymentsRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.loan', 'loan')
      .leftJoinAndSelect('loan.customer', 'customer')
      .leftJoinAndSelect('payment.createdBy', 'createdBy')
      .orderBy('payment.createdAt', 'DESC')
      .getMany();
  }

  async findByLoan(loanId: number): Promise<Payment[]> {
    return this.paymentsRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.loan', 'loan')
      .leftJoinAndSelect('loan.customer', 'customer')
      .where('payment.loan_id = :loanId', { loanId })
      .orderBy('payment.paymentDate', 'DESC')
      .getMany();
  }

  async findOne(id: number): Promise<Payment> {
    const payment = await this.paymentsRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.loan', 'loan')
      .leftJoinAndSelect('loan.customer', 'customer')
      .leftJoinAndSelect('payment.createdBy', 'createdBy')
      .where('payment.id = :id', { id })
      .getOne();

    if (!payment) {
      throw new NotFoundException('Pago no encontrado');
    }

    return payment;
  }

  async getPaymentHistory(loanId: number): Promise<{
    payments: Payment[];
    summary: {
      totalPaid: number;
      totalInterest: number;
      totalCapital: number;
      monthsPaid: number;
      remainingBalance: number;
      monthlyPayment: number;
    };
  }> {
    const loan = await this.loansService.findOne(loanId);

    if (!loan) {
      throw new NotFoundException('Préstamo no encontrado');
    }

    const payments = await this.findByLoan(loanId);

    const summary = {
      totalPaid: loan.totalInterestPaid + loan.totalCapitalPaid,
      totalInterest: loan.totalInterestPaid,
      totalCapital: loan.totalCapitalPaid,
      monthsPaid: loan.monthsPaid,
      remainingBalance: loan.currentBalance,
      monthlyPayment: Math.ceil(loan.currentBalance * (parseFloat(loan.monthlyInterestRate) / 100)),
    };

    return { payments, summary };
  }

  async findByDateRange(startDate: Date, endDate: Date) {
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

  async getOverdueLoans(): Promise<{
    count: number;
    totalAmount: number;
    loans: Loan[];
  }> {
    return this.loansService.findOverdueLoans();
  }

  async remove(id: number): Promise<void> {
    const payment = await this.findOne(id);

    await this.entityManager.transaction(async (transactionalEntityManager) => {
      const loan = await transactionalEntityManager.findOne(Loan, {
        where: { id: payment.loan.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!loan) {
        throw new NotFoundException('Préstamo asociado no encontrado.');
      }

      const paymentCapitalPaid = payment.capitalPaid;
      const paymentInterestPaid = payment.interestPaid;

      loan.currentBalance = loan.currentBalance + paymentCapitalPaid;
      loan.totalInterestPaid = loan.totalInterestPaid - paymentInterestPaid;
      loan.totalCapitalPaid = loan.totalCapitalPaid - paymentCapitalPaid;

      if (loan.status === LoanStatus.PAID) {
        loan.status = LoanStatus.ACTIVE;
      }

      await transactionalEntityManager.save(Loan, loan);
      await transactionalEntityManager.remove(Payment, payment);

      await this.cashMovementsService.revertMovement(
        'payment',
        id,
        transactionalEntityManager,
      );
    });
  }
}
