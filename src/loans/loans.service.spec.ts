import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LoansService } from './loans.service';
import { Loan, LoanStatus } from './entities/loan.entity';
import { MonthlyPayment } from './entities/monthly-payment.entity';
import { CashMovementsService } from '../cash-movements/cash-movements.service';
import { MovementType } from '../cash-movements/entities/cash-movement.entity';

describe('LoansService', () => {
  let service: LoansService;
  let mockLoansRepo: Record<string, jest.Mock>;
  let mockMonthlyPaymentRepo: Record<string, jest.Mock>;
  let mockCashMovementsService: Record<string, jest.Mock>;
  let mockTxManager: Record<string, jest.Mock>;
  let mockLoansQB: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockTxManager = {
      create: jest.fn().mockImplementation((_cls: any, data: any) => ({ ...data })),
      save: jest.fn().mockImplementation(async (data: any) => {
        if (Array.isArray(data)) return data;
        return { ...data, id: data.id || 1 };
      }),
    };

    const mockEntityManager = {
      transaction: jest.fn().mockImplementation(async (cb: any) => cb(mockTxManager)),
    };

    mockCashMovementsService = {
      recordMovement: jest.fn().mockResolvedValue({}),
    };

    mockLoansQB = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    mockLoansRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn().mockResolvedValue({}),
      delete: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockLoansQB),
    };

    mockMonthlyPaymentRepo = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoansService,
        { provide: getRepositoryToken(Loan), useValue: mockLoansRepo },
        { provide: getRepositoryToken(MonthlyPayment), useValue: mockMonthlyPaymentRepo },
        { provide: CashMovementsService, useValue: mockCashMovementsService },
        { provide: EntityManager, useValue: mockEntityManager },
      ],
    }).compile();

    service = module.get<LoansService>(LoansService);
  });

  describe('create', () => {
    it('sets currentBalance to totalToPay for Cápsula', async () => {
      const dto = {
        customerId: 1, loanDate: '2026-01-01', amount: 10000,
        loanType: 'Cápsula', modality: 'meses', term: 6,
        monthlyInterestRate: '5', totalToPay: 13000,
      };

      const result = await service.create(dto, 1);

      expect(result.currentBalance).toBe(13000);
    });

    it('sets currentBalance to amount when totalToPay is absent', async () => {
      const dto = {
        customerId: 1, loanDate: '2026-01-01', amount: 10000,
        loanType: 'Indefinido', monthlyInterestRate: '5',
      };

      const result = await service.create(dto, 1);

      expect(result.currentBalance).toBe(10000);
    });

    it('defaults monthlyInterestRate to 5 if not provided', async () => {
      const dto = {
        customerId: 1, loanDate: '2026-01-01', amount: 10000,
        loanType: 'Indefinido',
      };

      const result = await service.create(dto, 1);

      expect(result.monthlyInterestRate).toBe('5');
    });

    it('records a LOAN_OUT cash movement', async () => {
      const dto = {
        customerId: 1, loanDate: '2026-01-01', amount: 10000,
        loanType: 'Indefinido', monthlyInterestRate: '5',
      };

      await service.create(dto, 1);

      expect(mockCashMovementsService.recordMovement).toHaveBeenCalledWith(
        MovementType.LOAN_OUT,
        10000,
        expect.stringContaining('Préstamo #'),
        1,
        'loan',
        expect.any(Number),
        mockTxManager,
      );
    });
  });

  describe('createMonthlyPayment (via create)', () => {
    it('Cápsula meses: creates correct number of payments', async () => {
      const dto = {
        customerId: 1, loanDate: '2026-01-01', amount: 10000,
        loanType: 'Cápsula', modality: 'meses', term: 6,
        monthlyInterestRate: '5', totalToPay: 13000,
      };

      await service.create(dto, 1);

      // save is called: (1) loan, (2) monthlyPayments array
      const saveArrayCall = mockTxManager.save.mock.calls.find(
        (call: any[]) => Array.isArray(call[0]),
      );
      expect(saveArrayCall).toBeDefined();
      expect(saveArrayCall[0]).toHaveLength(6);

      // expectedAmount = ceil(13000/6) = 2167
      expect(saveArrayCall[0][0].expectedAmount).toBe(2167);
    });

    it('Cápsula quincenas: creates correct number and expected amount', async () => {
      const dto = {
        customerId: 1, loanDate: '2026-01-01', amount: 10000,
        loanType: 'Cápsula', modality: 'quincenas', term: 4,
        monthlyInterestRate: '5', totalToPay: 11000,
      };

      await service.create(dto, 1);

      const saveArrayCall = mockTxManager.save.mock.calls.find(
        (call: any[]) => Array.isArray(call[0]),
      );
      expect(saveArrayCall[0]).toHaveLength(4);

      // numberOfMonths = 4/2 = 2
      // totalToPayTheoretical = ceil(10000*0.05*2+10000) = 11000
      // expectedAmount = ceil(11000/4) = 2750
      expect(saveArrayCall[0][0].expectedAmount).toBe(2750);
    });

    it('Cápsula quincenas: alternates between 15th and end of month', async () => {
      const dto = {
        customerId: 1, loanDate: '2026-01-10T12:00:00', amount: 10000,
        loanType: 'Cápsula', modality: 'quincenas', term: 4,
        monthlyInterestRate: '5', totalToPay: 11000,
      };

      await service.create(dto, 1);

      const saveArrayCall = mockTxManager.save.mock.calls.find(
        (call: any[]) => Array.isArray(call[0]),
      );
      const dates: Date[] = saveArrayCall[0].map((mp: any) => mp.dueDate);

      // Jan 10 (<=15): first is Jan 15, then Jan 31, Feb 15, Feb 28
      expect(dates[0].getDate()).toBe(15);
      expect(dates[0].getMonth()).toBe(0);
      expect(dates[1].getDate()).toBe(31);
      expect(dates[1].getMonth()).toBe(0);
      expect(dates[2].getDate()).toBe(15);
      expect(dates[2].getMonth()).toBe(1);
      expect(dates[3].getMonth()).toBe(1); // February end
    });

    it('Indefinido: creates 60 interest-only payments', async () => {
      const dto = {
        customerId: 1, loanDate: '2026-01-01', amount: 10000,
        loanType: 'Indefinido', monthlyInterestRate: '5',
      };

      await service.create(dto, 1);

      const saveArrayCall = mockTxManager.save.mock.calls.find(
        (call: any[]) => Array.isArray(call[0]),
      );
      expect(saveArrayCall[0]).toHaveLength(60);

      // Interest only: ceil(10000 * 0.05) = 500
      expect(saveArrayCall[0][0].expectedAmount).toBe(500);
    });

    it('throws BadRequestException for unsupported loan type (with term)', async () => {
      const dto = {
        customerId: 1, loanDate: '2026-01-01', amount: 10000,
        loanType: 'Desconocido', monthlyInterestRate: '5', term: 6,
      };

      await expect(service.create(dto, 1)).rejects.toThrow(BadRequestException);
    });

    it('skips monthly payments when Cápsula has no term', async () => {
      const dto = {
        customerId: 1, loanDate: '2026-01-01', amount: 10000,
        loanType: 'Cápsula', modality: 'meses',
        monthlyInterestRate: '5', totalToPay: 13000,
      };

      const result = await service.create(dto, 1);

      // No monthly payments created (save not called with array)
      const saveArrayCall = mockTxManager.save.mock.calls.find(
        (call: any[]) => Array.isArray(call[0]),
      );
      expect(saveArrayCall).toBeUndefined();
      expect(result.currentBalance).toBe(13000);
    });
  });

  describe('findAll', () => {
    it('marks ACTIVE loan as OVERDUE in memory if monthlyPayments are past due', async () => {
      const loan: any = {
        id: 1,
        status: LoanStatus.ACTIVE,
        monthlyPayments: [
          { isPaid: false, dueDate: new Date('2025-01-01') },
        ],
      };
      mockLoansRepo.find.mockResolvedValue([loan]);

      const result = await service.findAll();

      expect(result[0].status).toBe(LoanStatus.OVERDUE);
    });

    it('does not change PAID loan status', async () => {
      const loan: any = {
        id: 1,
        status: LoanStatus.PAID,
        monthlyPayments: [
          { isPaid: false, dueDate: new Date('2025-01-01') },
        ],
      };
      mockLoansRepo.find.mockResolvedValue([loan]);

      const result = await service.findAll();

      expect(result[0].status).toBe(LoanStatus.PAID);
    });

    it('keeps ACTIVE if all payments are paid or future', async () => {
      const loan: any = {
        id: 1,
        status: LoanStatus.ACTIVE,
        monthlyPayments: [
          { isPaid: true, dueDate: new Date('2025-01-01') },
          { isPaid: false, dueDate: new Date('2027-12-31') },
        ],
      };
      mockLoansRepo.find.mockResolvedValue([loan]);

      const result = await service.findAll();

      expect(result[0].status).toBe(LoanStatus.ACTIVE);
    });
  });

  describe('getLoanDetails', () => {
    it('accumulates overdueAmount and overduePeriodsCount', async () => {
      mockLoansRepo.findOne.mockResolvedValue({
        id: 1,
        currentBalance: 10000,
        monthlyInterestRate: '5',
        modality: 'meses',
        monthlyPayments: [
          { isPaid: false, dueDate: new Date('2025-11-30'), expectedAmount: 2000 },
          { isPaid: false, dueDate: new Date('2025-12-31'), expectedAmount: 2000 },
          { isPaid: true, dueDate: new Date('2025-10-31'), expectedAmount: 2000 },
          { isPaid: false, dueDate: new Date('2027-06-30'), expectedAmount: 2000 },
        ],
      });

      const result = await service.getLoanDetails(1);

      expect(result.accumulatedOverdueAmount).toBe(4000);
      expect(result.overduePeriodsCount).toBe(2);
    });

    it('sets overduePeriodsUnit based on modality', async () => {
      mockLoansRepo.findOne.mockResolvedValue({
        id: 1, currentBalance: 10000, monthlyInterestRate: '5',
        modality: 'quincenas', monthlyPayments: [],
      });

      const result = await service.getLoanDetails(1);

      expect(result.overduePeriodsUnit).toBe('quincenas');
    });

    it('throws NotFoundException if loan not found', async () => {
      mockLoansRepo.findOne.mockResolvedValue(null);

      await expect(service.getLoanDetails(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateOverdueStatuses', () => {
    it('marks ACTIVE loans as OVERDUE and returns counts', async () => {
      const overdueLoans = [
        { id: 1, status: LoanStatus.ACTIVE },
        { id: 2, status: LoanStatus.ACTIVE },
      ];
      const activeLoans = [
        { id: 3, status: LoanStatus.OVERDUE },
      ];

      mockLoansQB.getMany
        .mockResolvedValueOnce(overdueLoans)
        .mockResolvedValueOnce(activeLoans);

      const result = await service.updateOverdueStatuses();

      expect(result.markedOverdue).toBe(2);
      expect(result.restoredActive).toBe(1);
      expect(overdueLoans[0].status).toBe(LoanStatus.OVERDUE);
      expect(overdueLoans[1].status).toBe(LoanStatus.OVERDUE);
      expect(activeLoans[0].status).toBe(LoanStatus.ACTIVE);
      expect(mockLoansRepo.save).toHaveBeenCalledTimes(3);
    });
  });

  describe('findOne', () => {
    it('returns loan if found', async () => {
      mockLoansRepo.findOne.mockResolvedValue({ id: 1 });

      const result = await service.findOne(1);

      expect(result).toEqual({ id: 1 });
    });

    it('throws NotFoundException if not found', async () => {
      mockLoansRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });
});
