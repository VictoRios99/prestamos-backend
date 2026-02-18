import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Payment, PaymentType } from './entities/payment.entity';
import { Loan, LoanStatus } from '../loans/entities/loan.entity';
import { MonthlyPayment } from '../loans/entities/monthly-payment.entity';
import { CashMovementsService } from '../cash-movements/cash-movements.service';
import { LoansService } from '../loans/loans.service';
import { MovementType } from '../cash-movements/entities/cash-movement.entity';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let mockTxManager: Record<string, jest.Mock>;
  let mockCashMovementsService: Record<string, jest.Mock>;
  let mockQB: Record<string, jest.Mock>;

  function makeLoan(overrides: Partial<any> = {}): any {
    return {
      id: 1,
      amount: 10000,
      currentBalance: 13000,
      monthlyInterestRate: '5',
      loanType: 'Cápsula',
      modality: 'meses',
      status: LoanStatus.ACTIVE,
      monthsPaid: 0,
      totalInterestPaid: 0,
      totalCapitalPaid: 0,
      monthlyPayments: [],
      lastPaymentDate: null,
      ...overrides,
    };
  }

  function setupLoanInTransaction(loan: any) {
    mockTxManager.findOne
      .mockResolvedValueOnce(loan)
      .mockResolvedValueOnce(loan);
  }

  beforeEach(async () => {
    mockTxManager = {
      findOne: jest.fn(),
      save: jest.fn().mockResolvedValue({ id: 1 }),
      create: jest.fn().mockImplementation((_cls: any, data: any) => ({ ...data })),
      count: jest.fn().mockResolvedValue(0),
      remove: jest.fn(),
    };

    const mockEntityManager = {
      transaction: jest.fn().mockImplementation(async (cb: any) => cb(mockTxManager)),
    };

    mockCashMovementsService = {
      recordMovement: jest.fn().mockResolvedValue({}),
      revertMovement: jest.fn().mockResolvedValue(undefined),
    };

    mockQB = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
      getMany: jest.fn().mockResolvedValue([]),
    };

    const mockPaymentsRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQB),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: mockPaymentsRepo },
        { provide: LoansService, useValue: {} },
        { provide: CashMovementsService, useValue: mockCashMovementsService },
        { provide: EntityManager, useValue: mockEntityManager },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  describe('create - amount mode', () => {
    it('Cápsula meses: splits interest/capital, rests full amount from balance', async () => {
      // interest = ceil(10000 * 0.05) = 500, capital = 1500-500 = 1000
      // Cápsula balance = 13000 - 1500 = 11500
      const loan = makeLoan();
      setupLoanInTransaction(loan);

      await service.create({ loanId: 1, paymentDate: '2026-01-15', amount: 1500 }, 1);

      expect(loan.currentBalance).toBe(11500);
      expect(loan.totalInterestPaid).toBe(500);
      expect(loan.totalCapitalPaid).toBe(1000);
      expect(loan.monthsPaid).toBe(1);
    });

    it('Indefinido: rests only capital from balance', async () => {
      // interest = 500, capital = 1000
      // Indefinido balance = 10000 - 1000 = 9000
      const loan = makeLoan({ loanType: 'Indefinido', currentBalance: 10000 });
      setupLoanInTransaction(loan);

      await service.create({ loanId: 1, paymentDate: '2026-01-15', amount: 1500 }, 1);

      expect(loan.currentBalance).toBe(9000);
      expect(loan.totalInterestPaid).toBe(500);
      expect(loan.totalCapitalPaid).toBe(1000);
    });

    it('Cápsula quincenas: halves the interest rate per period', async () => {
      // rate per quincena = 0.05/2 = 0.025
      // interest = ceil(10000 * 0.025) = 250, capital = 1000-250 = 750
      const loan = makeLoan({ modality: 'quincenas', currentBalance: 11000 });
      setupLoanInTransaction(loan);

      await service.create({ loanId: 1, paymentDate: '2026-01-15', amount: 1000 }, 1);

      expect(loan.totalInterestPaid).toBe(250);
      expect(loan.totalCapitalPaid).toBe(750);
      expect(loan.currentBalance).toBe(10000);
    });

    it('caps capital at currentBalance when it exceeds', async () => {
      const loan = makeLoan({ currentBalance: 600 });
      setupLoanInTransaction(loan);

      await service.create({ loanId: 1, paymentDate: '2026-01-15', amount: 1500 }, 1);

      // interest=500, capital would be 1000 but capped at 600
      expect(loan.totalCapitalPaid).toBe(600);
    });

    it('payment <= interest: all goes to interest, no capital', async () => {
      const loan = makeLoan();
      setupLoanInTransaction(loan);

      await service.create({ loanId: 1, paymentDate: '2026-01-15', amount: 300 }, 1);

      expect(loan.totalInterestPaid).toBe(300);
      expect(loan.totalCapitalPaid).toBe(0);
      expect(loan.currentBalance).toBe(12700); // Cápsula: 13000 - 300
    });
  });

  describe('create - split mode', () => {
    it('uses capitalAmount + interestAmount, rests only capital from balance', async () => {
      const loan = makeLoan();
      setupLoanInTransaction(loan);

      await service.create({
        loanId: 1, paymentDate: '2026-01-15',
        capitalAmount: 800, interestAmount: 500,
      }, 1);

      expect(loan.totalCapitalPaid).toBe(800);
      expect(loan.totalInterestPaid).toBe(500);
      expect(loan.currentBalance).toBe(12200); // 13000 - 800
    });

    it('caps capital at currentBalance', async () => {
      const loan = makeLoan({ currentBalance: 500 });
      setupLoanInTransaction(loan);

      await service.create({
        loanId: 1, paymentDate: '2026-01-15',
        capitalAmount: 800, interestAmount: 200,
      }, 1);

      expect(loan.totalCapitalPaid).toBe(500);
      expect(loan.currentBalance).toBe(0);
      expect(loan.status).toBe(LoanStatus.PAID);
    });

    it('throws if total is 0', async () => {
      const loan = makeLoan();
      setupLoanInTransaction(loan);

      await expect(
        service.create({
          loanId: 1, paymentDate: '2026-01-15',
          capitalAmount: 0, interestAmount: 0,
        }, 1),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('create - overdue periods mode', () => {
    it('pays multiple overdue periods for Cápsula', async () => {
      const mp1: any = { id: 10, isPaid: false, dueDate: new Date('2025-11-30'), expectedAmount: 2167 };
      const mp2: any = { id: 11, isPaid: false, dueDate: new Date('2025-12-31'), expectedAmount: 2167 };
      const loan = makeLoan({ term: 6, currentBalance: 13000, monthlyPayments: [mp1, mp2] });
      setupLoanInTransaction(loan);

      await service.create({ loanId: 1, paymentDate: '2026-01-15', overduePeriodsPaid: 2 }, 1);

      // Each: interest = ceil(10000*0.05) = 500, capital = 2167-500 = 1667
      expect(loan.totalInterestPaid).toBe(1000);
      expect(loan.totalCapitalPaid).toBe(3334);
      expect(loan.currentBalance).toBe(13000 - 4334);
      expect(loan.monthsPaid).toBe(2);
      expect(mp1.isPaid).toBe(true);
      expect(mp2.isPaid).toBe(true);
    });

    it('uses halved rate for quincenas in overdue mode', async () => {
      const mp1: any = { id: 10, isPaid: false, dueDate: new Date('2025-12-15'), expectedAmount: 2750 };
      const loan = makeLoan({
        modality: 'quincenas', term: 4, currentBalance: 11000,
        monthlyPayments: [mp1],
      });
      setupLoanInTransaction(loan);

      await service.create({ loanId: 1, paymentDate: '2026-01-15', overduePeriodsPaid: 1 }, 1);

      // interest = ceil(10000 * 0.025) = 250, capital = 2750-250 = 2500
      expect(loan.totalInterestPaid).toBe(250);
      expect(loan.totalCapitalPaid).toBe(2500);
    });

    it('rejects overdue periods for non-Cápsula', async () => {
      const loan = makeLoan({ loanType: 'Indefinido', currentBalance: 10000 });
      setupLoanInTransaction(loan);

      await expect(
        service.create({ loanId: 1, paymentDate: '2026-01-15', overduePeriodsPaid: 1 }, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects if overduePeriodsPaid exceeds actual overdue count', async () => {
      const mp1: any = { id: 10, isPaid: false, dueDate: new Date('2025-12-31'), expectedAmount: 2167 };
      const loan = makeLoan({ monthlyPayments: [mp1] });
      setupLoanInTransaction(loan);

      await expect(
        service.create({ loanId: 1, paymentDate: '2026-01-15', overduePeriodsPaid: 5 }, 1),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('create - validations', () => {
    it('throws NotFoundException if loan not found', async () => {
      mockTxManager.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      await expect(
        service.create({ loanId: 999, paymentDate: '2026-01-15', amount: 100 }, 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if loan is PAID', async () => {
      const loan = makeLoan({ status: LoanStatus.PAID });
      setupLoanInTransaction(loan);

      await expect(
        service.create({ loanId: 1, paymentDate: '2026-01-15', amount: 100 }, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if balance is 0', async () => {
      const loan = makeLoan({ currentBalance: 0 });
      setupLoanInTransaction(loan);

      await expect(
        service.create({ loanId: 1, paymentDate: '2026-01-15', amount: 100 }, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if amount <= 0', async () => {
      const loan = makeLoan();
      setupLoanInTransaction(loan);

      await expect(
        service.create({ loanId: 1, paymentDate: '2026-01-15', amount: 0 }, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if no payment mode specified', async () => {
      const loan = makeLoan();
      setupLoanInTransaction(loan);

      await expect(
        service.create({ loanId: 1, paymentDate: '2026-01-15' }, 1),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('create - monthly payment marking', () => {
    it('marks next unpaid monthly_payment as paid on regular payment', async () => {
      const mp1: any = { id: 10, isPaid: true, dueDate: new Date('2025-11-30') };
      const mp2: any = { id: 11, isPaid: false, dueDate: new Date('2025-12-31'), expectedAmount: 2167 };
      const mp3: any = { id: 12, isPaid: false, dueDate: new Date('2026-01-31'), expectedAmount: 2167 };
      const loan = makeLoan({ monthlyPayments: [mp1, mp2, mp3] });
      setupLoanInTransaction(loan);

      await service.create({ loanId: 1, paymentDate: '2026-01-15', amount: 2167 }, 1);

      expect(mp2.isPaid).toBe(true);
      expect(mp2.paidAmount).toBe(2167);
      expect(mp3.isPaid).toBe(false);
    });
  });

  describe('create - receipt number', () => {
    it('generates REC-YYYYMM-#### format with sequential count', async () => {
      const loan = makeLoan();
      setupLoanInTransaction(loan);
      mockTxManager.count.mockResolvedValue(5);

      await service.create({ loanId: 1, paymentDate: '2026-01-15', amount: 500 }, 1);

      const createCall = mockTxManager.create.mock.calls.find(
        (call: any[]) => call[0] === Payment,
      );
      expect(createCall[1].receiptNumber).toMatch(/^REC-\d{6}-0006$/);
    });
  });

  describe('create - lateInterest', () => {
    it('includes lateInterest in cashMovement amount but not in balance', async () => {
      const loan = makeLoan();
      setupLoanInTransaction(loan);

      await service.create({
        loanId: 1, paymentDate: '2026-01-15', amount: 1500, lateInterest: 200,
      }, 1);

      expect(loan.currentBalance).toBe(11500); // only 1500 deducted
      expect(mockCashMovementsService.recordMovement).toHaveBeenCalledWith(
        MovementType.PAYMENT_IN,
        1700, // 1500 + 200
        expect.any(String),
        1, 'payment', 1, mockTxManager,
      );
    });
  });

  describe('create - payment type', () => {
    it('sets BOTH when capital > 0 and interest > 0', async () => {
      const loan = makeLoan();
      setupLoanInTransaction(loan);

      await service.create({ loanId: 1, paymentDate: '2026-01-15', amount: 1500 }, 1);

      const createCall = mockTxManager.create.mock.calls.find((c: any[]) => c[0] === Payment);
      expect(createCall[1].paymentType).toBe(PaymentType.BOTH);
    });

    it('sets INTEREST when only interest is paid', async () => {
      const loan = makeLoan();
      setupLoanInTransaction(loan);

      await service.create({ loanId: 1, paymentDate: '2026-01-15', amount: 300 }, 1);

      const createCall = mockTxManager.create.mock.calls.find((c: any[]) => c[0] === Payment);
      expect(createCall[1].paymentType).toBe(PaymentType.INTEREST);
    });

    it('sets CAPITAL when only capital via split mode', async () => {
      const loan = makeLoan();
      setupLoanInTransaction(loan);

      await service.create({
        loanId: 1, paymentDate: '2026-01-15',
        capitalAmount: 500, interestAmount: 0,
      }, 1);

      const createCall = mockTxManager.create.mock.calls.find((c: any[]) => c[0] === Payment);
      expect(createCall[1].paymentType).toBe(PaymentType.CAPITAL);
    });
  });

  describe('create - loan paid off', () => {
    it('sets status to PAID when balance reaches 0', async () => {
      const loan = makeLoan({ currentBalance: 1000 });
      setupLoanInTransaction(loan);

      await service.create({ loanId: 1, paymentDate: '2026-01-15', amount: 1000 }, 1);

      expect(loan.currentBalance).toBe(0);
      expect(loan.status).toBe(LoanStatus.PAID);
    });
  });

  describe('remove', () => {
    function setupRemove(payment: any, loan: any) {
      mockQB.getOne.mockResolvedValue(payment);
      mockTxManager.findOne.mockResolvedValue(loan);
    }

    it('Cápsula: restores full payment amount to balance', async () => {
      const loan: any = {
        id: 10, currentBalance: 8000, loanType: 'Cápsula',
        totalInterestPaid: 1000, totalCapitalPaid: 3000,
        status: LoanStatus.ACTIVE,
      };
      setupRemove(
        { id: 1, amount: 2000, capitalPaid: 1500, interestPaid: 500, loan: { id: 10 } },
        loan,
      );

      await service.remove(1);

      expect(loan.currentBalance).toBe(10000); // 8000 + 2000
      expect(loan.totalInterestPaid).toBe(500);
      expect(loan.totalCapitalPaid).toBe(1500);
    });

    it('Indefinido: restores only capital to balance', async () => {
      const loan: any = {
        id: 10, currentBalance: 9000, loanType: 'Indefinido',
        totalInterestPaid: 500, totalCapitalPaid: 1000,
        status: LoanStatus.ACTIVE,
      };
      setupRemove(
        { id: 1, amount: 1500, capitalPaid: 1000, interestPaid: 500, loan: { id: 10 } },
        loan,
      );

      await service.remove(1);

      expect(loan.currentBalance).toBe(10000); // 9000 + 1000
    });

    it('changes PAID status back to ACTIVE', async () => {
      const loan: any = {
        id: 10, currentBalance: 0, loanType: 'Cápsula',
        totalInterestPaid: 500, totalCapitalPaid: 1000,
        status: LoanStatus.PAID,
      };
      setupRemove(
        { id: 1, amount: 1500, capitalPaid: 1000, interestPaid: 500, loan: { id: 10 } },
        loan,
      );

      await service.remove(1);

      expect(loan.status).toBe(LoanStatus.ACTIVE);
    });

    it('calls revertMovement on cashMovementsService', async () => {
      const loan: any = {
        id: 10, currentBalance: 8000, loanType: 'Cápsula',
        totalInterestPaid: 500, totalCapitalPaid: 1000,
        status: LoanStatus.ACTIVE,
      };
      setupRemove(
        { id: 1, amount: 1500, capitalPaid: 1000, interestPaid: 500, loan: { id: 10 } },
        loan,
      );

      await service.remove(1);

      expect(mockCashMovementsService.revertMovement).toHaveBeenCalledWith(
        'payment', 1, mockTxManager,
      );
    });
  });
});
