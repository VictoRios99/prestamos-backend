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

/** Redondea a 2 decimales (sin redondear hacia arriba) */
function roundTwo(v: number): number {
  return Math.round(v * 100) / 100;
}

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private paymentsRepository: Repository<Payment>,
    private readonly loansService: LoansService,
    private readonly cashMovementsService: CashMovementsService,
    private readonly entityManager: EntityManager,
  ) {}

  /** Parse a date string ('YYYY-MM-DD' or ISO) into local midnight, avoiding UTC shift */
  private parseLocalDate(d: string | Date): Date {
    if (typeof d === 'string') {
      const dateOnly = d.includes('T') ? d.split('T')[0] : d;
      const [y, m, day] = dateOnly.split('-').map(Number);
      return new Date(y, m - 1, day);
    }
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }

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

          // Forzar conversión numérica (DB devuelve strings para columnas numeric)
          const currentBalance = Number(loan.currentBalance);
          const loanAmount = Number(loan.amount);

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
              .filter(mp => !mp.isPaid && this.parseLocalDate(mp.dueDate) < new Date())
              .sort((a, b) => this.parseLocalDate(a.dueDate).getTime() - this.parseLocalDate(b.dueDate).getTime());

            if (overduePeriodsPaid > overdueMonthlyPayments.length) {
              throw new BadRequestException('El número de periodos a pagar excede los periodos vencidos.');
            }

            let totalAmountPaid = 0;
            let totalCapitalPaidFromOverdue = 0;
            let totalInterestPaidFromOverdue = 0;

            for (let i = 0; i < overduePeriodsPaid; i++) {
              const mp = overdueMonthlyPayments[i];
              const expectedAmount = Number(mp.expectedAmount);
              totalAmountPaid = totalAmountPaid + expectedAmount;

              // Calcular interés según modalidad (quincenas o meses)
              const monthlyInterestRate = parseFloat(loan.monthlyInterestRate) / 100;
              let interestRateForPeriod = monthlyInterestRate;

              if (loan.modality === 'quincenas') {
                interestRateForPeriod = monthlyInterestRate / 2;
              }

              const interestForPeriod = roundTwo(loanAmount * interestRateForPeriod);

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
              mp.paymentDate = this.parseLocalDate(paymentDate);
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

              // Validar que no sean pagos parciales en Cápsulas
              if (loan.loanType === 'Cápsula' && loan.monthlyPayments) {
                const nextUnpaidForValidation = loan.monthlyPayments
                  .filter(mp => !mp.isPaid)
                  .sort((a, b) => this.parseLocalDate(a.dueDate).getTime() - this.parseLocalDate(b.dueDate).getTime())[0];
                const minPayment = nextUnpaidForValidation
                  ? Math.min(Number(nextUnpaidForValidation.expectedAmount), currentBalance)
                  : currentBalance;
                if (totalPaymentReceived < minPayment) {
                  throw new BadRequestException(
                    `No se permiten pagos parciales en préstamos tipo Cápsula. El monto mínimo es $${minPayment.toLocaleString('es-MX')}.`
                  );
                }
              }

              // Calcular interés según modalidad (quincenas o meses)
              const monthlyInterestRate = parseFloat(loan.monthlyInterestRate) / 100;
              let interestRateForPeriod = monthlyInterestRate;

              if (loan.loanType === 'Cápsula' && loan.modality === 'quincenas') {
                interestRateForPeriod = monthlyInterestRate / 2;
              }

              // Cápsula: interés fijo sobre monto original
              // Indefinido: interés sobre capital vigente (se recalcula al pagar capital)
              const interestBase = loan.loanType === 'Cápsula' ? loanAmount : currentBalance;
              const interestForPeriod = roundTwo(interestBase * interestRateForPeriod);

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
              // Cápsula: balance = total a pagar, restar pago completo
              // Indefinido: balance = solo capital, restar solo capital
              if (loan.loanType === 'Cápsula') {
                loan.currentBalance = currentBalance - totalPaymentReceived;
              } else {
                loan.currentBalance = currentBalance - actualCapitalPaid;
              }
              loan.monthsPaid = (loan.monthsPaid || 0) + 1;

              // Marcar el siguiente monthly_payment impago como pagado
              if (loan.monthlyPayments && loan.monthlyPayments.length > 0) {
                const nextUnpaid = loan.monthlyPayments
                  .filter(mp => !mp.isPaid)
                  .sort((a, b) => this.parseLocalDate(a.dueDate).getTime() - this.parseLocalDate(b.dueDate).getTime())[0];
                if (nextUnpaid) {
                  nextUnpaid.isPaid = true;
                  nextUnpaid.paidAmount = totalPaymentReceived;
                  nextUnpaid.paymentDate = this.parseLocalDate(paymentDate);
                  nextUnpaid.interestPaid = actualInterestPaid;
                  nextUnpaid.capitalPaid = actualCapitalPaid;
                  await transactionalEntityManager.save(MonthlyPayment, nextUnpaid);
                }
              }

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
              // Modo split: siempre restar solo capital del balance
              loan.currentBalance = currentBalance - actualCapitalPaid;
              loan.monthsPaid = (loan.monthsPaid || 0) + 1;
            } else {
              throw new BadRequestException('Debe proporcionar un monto de pago válido.');
            }
          }

          loan.totalInterestPaid = Number(loan.totalInterestPaid) + actualInterestPaid;
          loan.totalCapitalPaid = Number(loan.totalCapitalPaid) + actualCapitalPaid;
          loan.lastPaymentDate = this.parseLocalDate(paymentDate);

          if (loan.currentBalance <= 0) {
            loan.currentBalance = 0;
            loan.status = LoanStatus.PAID;
          } else if (loan.status === LoanStatus.OVERDUE) {
            loan.status = LoanStatus.ACTIVE;
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
            paymentDate: this.parseLocalDate(paymentDate),
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
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      console.error('Payment processing error:', error);
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
      monthlyPayment: roundTwo(loan.currentBalance * (parseFloat(loan.monthlyInterestRate) / 100)),
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

      // Cápsula: balance = total a pagar, restaurar monto completo del pago
      // Indefinido: balance = solo capital, restaurar solo capital
      if (loan.loanType === 'Cápsula') {
        loan.currentBalance = loan.currentBalance + payment.amount;
      } else {
        loan.currentBalance = loan.currentBalance + paymentCapitalPaid;
      }
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
