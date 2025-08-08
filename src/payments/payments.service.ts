import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
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
import { Decimal } from 'decimal.js';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private paymentsRepository: Repository<Payment>,
    private readonly loansService: LoansService,
    private readonly cashMovementsService: CashMovementsService,
    private readonly entityManager: EntityManager,
  ) {}

  async create(createPaymentDto: CreatePaymentDto, userId: number): Promise<Payment> {
    const { loanId, amount, paymentDate, paymentMethod, notes } = createPaymentDto;
    const amountDecimal = new Decimal(amount);

    if (amountDecimal.lte(0)) {
      throw new BadRequestException('El monto debe ser mayor a 0');
    }

    try {
      return await this.entityManager.transaction(async (transactionalEntityManager) => {
        const loan = await transactionalEntityManager.findOne(Loan, {
          where: { id: loanId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!loan) {
          throw new NotFoundException('Préstamo no encontrado');
        }

        if (loan.status !== LoanStatus.ACTIVE) {
          throw new BadRequestException('No se puede pagar un préstamo inactivo');
        }

        if (new Decimal(loan.currentBalance).lte(0)) {
          throw new BadRequestException('El préstamo ya está pagado completamente');
        }

        const interestRate = new Decimal(0.05);
        const currentBalance = new Decimal(loan.currentBalance);
        const interestForMonth = currentBalance.times(interestRate);

        let interestPaid: Decimal;
        let capitalPaid: Decimal;

        if (amountDecimal.lte(interestForMonth)) {
          interestPaid = amountDecimal;
          capitalPaid = new Decimal(0);
        } else {
          interestPaid = interestForMonth;
          capitalPaid = amountDecimal.minus(interestForMonth);
        }

        loan.currentBalance = currentBalance.minus(capitalPaid).toString();
        loan.totalInterestPaid = new Decimal(loan.totalInterestPaid).plus(interestPaid).toString();
        loan.totalCapitalPaid = new Decimal(loan.totalCapitalPaid).plus(capitalPaid).toString();
        loan.lastPaymentDate = new Date(paymentDate);

        const monthlyPaymentToUpdate = await transactionalEntityManager.findOne(MonthlyPayment, {
          where: { loan: { id: loanId }, isPaid: false },
          order: { dueDate: 'ASC' },
        });

        if (monthlyPaymentToUpdate) {
          const paidAmount = new Decimal(monthlyPaymentToUpdate.paidAmount).plus(amountDecimal);
          monthlyPaymentToUpdate.paidAmount = paidAmount.toString();
          monthlyPaymentToUpdate.interestPaid = new Decimal(monthlyPaymentToUpdate.interestPaid).plus(interestPaid).toString();
          monthlyPaymentToUpdate.capitalPaid = new Decimal(monthlyPaymentToUpdate.capitalPaid).plus(capitalPaid).toString();
          monthlyPaymentToUpdate.paymentDate = new Date(paymentDate);

          if (paidAmount.gte(new Decimal(monthlyPaymentToUpdate.expectedAmount))) {
            monthlyPaymentToUpdate.isPaid = true;
            loan.monthsPaid += 1;
          }
          await transactionalEntityManager.save(MonthlyPayment, monthlyPaymentToUpdate);
        } else {
          console.log(`No pending monthly payment found to update for loan: ${loanId}`);
        }

        if (new Decimal(loan.currentBalance).lte(0.01)) {
          loan.currentBalance = '0';
          loan.status = LoanStatus.PAID;
        }
        
        await transactionalEntityManager.save(Loan, loan);

        let paymentType: PaymentType = PaymentType.INTEREST;
        if (capitalPaid.gt(0) && interestPaid.gt(0)) {
          paymentType = PaymentType.BOTH;
        } else if (capitalPaid.gt(0) && interestPaid.eq(0)) {
          paymentType = PaymentType.CAPITAL;
        }

        const receiptNumber = await this.generateReceiptNumber(transactionalEntityManager);
        
        const payment = transactionalEntityManager.create(Payment, {
          loan,
          paymentDate: new Date(paymentDate),
          amount: amountDecimal.toString(),
          paymentType,
          paymentMethod: paymentMethod ?? 'CASH',
          receiptNumber,
          notes: notes ?? '',
          interestPaid: interestPaid.toString(),
          capitalPaid: capitalPaid.toString(),
          createdBy: { id: userId } as User,
        });

        const savedPayment = await transactionalEntityManager.save(Payment, payment);

        await this.cashMovementsService.recordMovement(
          MovementType.PAYMENT_IN,
          amountDecimal.toNumber(),
          `Pago #${savedPayment.id} - Préstamo #${loanId} - Recibo: ${receiptNumber} - Interés: ${interestPaid.toFixed(2)}, Capital: ${capitalPaid.toFixed(2)}`,
          userId,
          'payment',
          savedPayment.id,
          transactionalEntityManager,
        );

        return savedPayment;
      });
    } catch (error) {
      
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
    return this.paymentsRepository.createQueryBuilder('payment')
      .leftJoinAndSelect('payment.loan', 'loan')
      .leftJoinAndSelect('loan.customer', 'customer')
      .leftJoinAndSelect('payment.createdBy', 'createdBy')
      .orderBy('payment.createdAt', 'DESC')
      .getMany();
  }

  async findByLoan(loanId: number): Promise<Payment[]> {
    return this.paymentsRepository.createQueryBuilder('payment')
      .leftJoinAndSelect('payment.loan', 'loan')
      .leftJoinAndSelect('loan.customer', 'customer')
      .where('payment.loan_id = :loanId', { loanId })
      .orderBy('payment.paymentDate', 'DESC')
      .getMany();
  }

  async findOne(id: number): Promise<Payment> {
    const payment = await this.paymentsRepository.createQueryBuilder('payment')
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
      totalPaid: string;
      totalInterest: string;
      totalCapital: string;
      monthsPaid: number;
      remainingBalance: string;
      monthlyPayment: string;
    }
  }> {
    const loan = await this.loansService.findOne(loanId);

    if (!loan) {
      throw new NotFoundException('Préstamo no encontrado');
    }

    const payments = await this.findByLoan(loanId);
    
    const summary = {
      totalPaid: new Decimal(loan.totalInterestPaid).plus(new Decimal(loan.totalCapitalPaid)).toString(),
      totalInterest: new Decimal(loan.totalInterestPaid).toString(),
      totalCapital: new Decimal(loan.totalCapitalPaid).toString(),
      monthsPaid: loan.monthsPaid,
      remainingBalance: new Decimal(loan.currentBalance).toString(),
      monthlyPayment: new Decimal(loan.currentBalance).times(0.05).toString(),
    };

    return { payments, summary };
  }

  async findByDateRange(startDate: Date, endDate: Date) {
    return this.paymentsRepository.createQueryBuilder('payment')
      .leftJoinAndSelect('payment.loan', 'loan')
      .leftJoinAndSelect('loan.customer', 'customer')
      .where('payment.paymentDate BETWEEN :startDate AND :endDate', { startDate, endDate })
      .orderBy('payment.paymentDate', 'DESC')
      .getMany();
  }

  async getOverdueLoans(): Promise<{
    count: number;
    totalAmount: number;
    loans: Loan[];
  }> {
    return this.loansService.getOverdueLoans();
  }

  async remove(id: number): Promise<void> {
    const payment = await this.findOne(id);
    
    await this.entityManager.transaction(async (transactionalEntityManager) => {
      const loan = await transactionalEntityManager.findOne(Loan, { 
        where: { id: payment.loan.id },
        lock: { mode: 'pessimistic_write' }
      });

      if (!loan) {
        throw new NotFoundException('Préstamo asociado no encontrado.');
      }

      const paymentCapitalPaid = new Decimal(payment.capitalPaid);
      const paymentInterestPaid = new Decimal(payment.interestPaid);

      loan.currentBalance = new Decimal(loan.currentBalance).plus(paymentCapitalPaid).toString();
      loan.totalInterestPaid = new Decimal(loan.totalInterestPaid).minus(paymentInterestPaid).toString();
      loan.totalCapitalPaid = new Decimal(loan.totalCapitalPaid).minus(paymentCapitalPaid).toString();
      
      if (loan.status === LoanStatus.PAID) {
        loan.status = LoanStatus.ACTIVE;
      }
      
      await transactionalEntityManager.save(Loan, loan);
      await transactionalEntityManager.remove(Payment, payment);

      await this.cashMovementsService.revertMovement(
        'payment',
        id,
        transactionalEntityManager
      );
    });
  }

  async settleLoan(loanId: number, userId: number): Promise<Payment> {
    return this.entityManager.transaction(async (transactionalEntityManager) => {
      const loan = await transactionalEntityManager.findOne(Loan, {
        where: { id: loanId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!loan) {
        throw new NotFoundException('Préstamo no encontrado');
      }

      const monthlyPayments = await transactionalEntityManager.find(MonthlyPayment, {
        where: { loan: { id: loanId } },
      });
      loan.monthlyPayments = monthlyPayments;

      if (loan.status !== LoanStatus.ACTIVE) {
        throw new BadRequestException('Solo se pueden liquidar préstamos activos');
      }

      const currentBalance = new Decimal(loan.currentBalance);
      if (currentBalance.lte(0)) {
        throw new BadRequestException('El préstamo ya está pagado completamente');
      }

      // Calcular el interés pendiente del mes actual (si aplica)
      const monthlyInterestRate = new Decimal(0.05);
      const interestForCurrentPeriod = currentBalance.times(monthlyInterestRate);

      // El monto total a pagar para liquidar es el saldo actual más el interés del mes actual
      const totalSettlementAmount = currentBalance.plus(interestForCurrentPeriod);

      // Crear el pago de liquidación
      const receiptNumber = await this.generateReceiptNumber(transactionalEntityManager);
      
      const settlementPayment = transactionalEntityManager.create(Payment, {
        loan,
        paymentDate: new Date(),
        amount: totalSettlementAmount.toString(),
        paymentType: PaymentType.BOTH, // O CAPITAL, dependiendo de la política
        paymentMethod: 'CASH', // Se puede hacer configurable
        receiptNumber,
        notes: 'Liquidación total del préstamo',
        interestPaid: interestForCurrentPeriod.toString(),
        capitalPaid: currentBalance.toString(),
        createdBy: { id: userId } as User,
      });

      const savedPayment = await transactionalEntityManager.save(Payment, settlementPayment);

      // Actualizar el préstamo
      loan.currentBalance = '0';
      loan.totalInterestPaid = new Decimal(loan.totalInterestPaid).plus(interestForCurrentPeriod).toString();
      loan.totalCapitalPaid = new Decimal(loan.totalCapitalPaid).plus(currentBalance).toString();
      loan.lastPaymentDate = new Date();
      loan.status = LoanStatus.PAID;
      loan.monthsPaid = new Decimal(loan.monthsPaid).plus(1).toNumber(); // Se considera un mes pagado al liquidar
      await transactionalEntityManager.save(Loan, loan);

      // Marcar todos los pagos mensuales pendientes como pagados
      const pendingMonthlyPayments = loan.monthlyPayments.filter(mp => !mp.isPaid);
      for (const mp of pendingMonthlyPayments) {
        mp.isPaid = true;
        mp.paymentDate = new Date();
        mp.paidAmount = new Decimal(mp.expectedAmount).toString(); // Asumimos que se paga el total esperado
        mp.interestPaid = new Decimal(mp.expectedAmount).times(monthlyInterestRate).toString(); // Esto puede variar
        mp.capitalPaid = new Decimal(mp.expectedAmount).minus(new Decimal(mp.interestPaid)).toString();
        await transactionalEntityManager.save(MonthlyPayment, mp);
      }

      // Registrar movimiento de caja
      await this.cashMovementsService.recordMovement(
        MovementType.PAYMENT_IN,
        totalSettlementAmount.toNumber(),
        `Liquidación Préstamo #${loanId} - Recibo: ${receiptNumber}`,
        userId,
        'payment',
        savedPayment.id,
        transactionalEntityManager,
      );

      return savedPayment;
    });
  }
}