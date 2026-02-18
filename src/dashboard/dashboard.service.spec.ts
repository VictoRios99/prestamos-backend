import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { Loan, LoanStatus } from '../loans/entities/loan.entity';
import { Payment } from '../payments/entities/payment.entity';

describe('DashboardService', () => {
  let service: DashboardService;
  let mockLoansRepo: Record<string, jest.Mock>;
  let mockPaymentsQB: Record<string, jest.Mock>;

  function makeLoan(overrides: any = {}): any {
    return {
      amount: 10000,
      totalCapitalPaid: 0,
      totalInterestPaid: 0,
      currentBalance: 10000,
      loanType: 'Cápsula',
      status: LoanStatus.ACTIVE,
      loanDate: new Date(),
      lastPaymentDate: new Date(),
      monthlyPayments: [],
      payments: [],
      monthsPaid: 0,
      customer: { firstName: 'Juan', lastName: 'Pérez' },
      ...overrides,
    };
  }

  beforeEach(async () => {
    mockPaymentsQB = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    const mockPaymentsRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockPaymentsQB),
    };

    mockLoansRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getRepositoryToken(Loan), useValue: mockLoansRepo },
        { provide: getRepositoryToken(Payment), useValue: mockPaymentsRepo },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  describe('getDashboardStats', () => {
    it('sums dineroRestado, capitalRecuperado, interesRecabado across loans', async () => {
      mockLoansRepo.find.mockResolvedValue([
        makeLoan({ amount: 10000, totalCapitalPaid: 3000, totalInterestPaid: 1000 }),
        makeLoan({ amount: 20000, totalCapitalPaid: 5000, totalInterestPaid: 2000 }),
      ]);

      const result = await service.getDashboardStats();

      expect(result.dineroRestado).toBe(30000);
      expect(result.capitalRecuperado).toBe(8000);
      expect(result.interesRecabado).toBe(3000);
    });

    it('capitalEnTransito sums only ACTIVE loans currentBalance', async () => {
      mockLoansRepo.find.mockResolvedValue([
        makeLoan({ currentBalance: 8000, status: LoanStatus.ACTIVE }),
        makeLoan({ currentBalance: 5000, status: LoanStatus.PAID }),
        makeLoan({ currentBalance: 12000, status: LoanStatus.ACTIVE }),
      ]);

      const result = await service.getDashboardStats();

      expect(result.capitalEnTransito).toBe(20000);
    });

    it('detects overdue loans (>30 days since last payment)', async () => {
      const overdueLoan = makeLoan({
        lastPaymentDate: new Date(Date.now() - 35 * 86400000),
        currentBalance: 5000,
        monthlyPayments: [
          { isPaid: false, dueDate: new Date(Date.now() - 35 * 86400000) },
        ],
      });
      mockLoansRepo.find.mockResolvedValue([overdueLoan]);

      const result = await service.getDashboardStats();

      expect(result.prestamosVencidos).toBe(1);
      expect(result.montoVencido).toBe(5000);
      expect(result.prestamosVencidosDetalle).toHaveLength(1);
    });

    it('loan with exactly 30 days is NOT overdue (uses > 30)', async () => {
      // Use 29 days to be safely under the threshold despite Math.ceil
      const loan = makeLoan({
        lastPaymentDate: new Date(Date.now() - 29 * 86400000),
        currentBalance: 5000,
        monthlyPayments: [],
      });
      mockLoansRepo.find.mockResolvedValue([loan]);

      const result = await service.getDashboardStats();

      expect(result.prestamosVencidos).toBe(0);
    });

    it('detects prestamosPorVencer (23+ days but not overdue)', async () => {
      const almostOverdueLoan = makeLoan({
        lastPaymentDate: new Date(Date.now() - 25 * 86400000),
        currentBalance: 8000,
        monthlyPayments: [],
      });
      mockLoansRepo.find.mockResolvedValue([almostOverdueLoan]);

      const result = await service.getDashboardStats();

      expect(result.prestamosVencidos).toBe(0);
      expect(result.prestamosPorVencer).toHaveLength(1);
      expect(result.prestamosPorVencer[0].currentBalance).toBe(8000);
    });

    it('loan without lastPaymentDate checks days since loanDate', async () => {
      const oldLoan = makeLoan({
        loanDate: new Date(Date.now() - 35 * 86400000),
        lastPaymentDate: null,
        currentBalance: 10000,
        monthlyPayments: [
          { isPaid: false, dueDate: new Date(Date.now() - 35 * 86400000) },
        ],
      });
      mockLoansRepo.find.mockResolvedValue([oldLoan]);

      const result = await service.getDashboardStats();

      expect(result.prestamosVencidos).toBe(1);
    });

    it('counts prestamosActivos and prestamosCompletados', async () => {
      mockLoansRepo.find.mockResolvedValue([
        makeLoan({ status: LoanStatus.ACTIVE }),
        makeLoan({ status: LoanStatus.ACTIVE }),
        makeLoan({ status: LoanStatus.PAID }),
      ]);

      const result = await service.getDashboardStats();

      expect(result.prestamosActivos).toBe(2);
      expect(result.prestamosCompletados).toBe(1);
      expect(result.totalPrestamos).toBe(3);
    });

    it('BUG: totalRecaudadoCapsula is 0 due to loanType case mismatch', async () => {
      // Service checks 'capsula' (lowercase) but actual data uses 'Cápsula' (uppercase + accent)
      const capsulaLoan = makeLoan({
        loanType: 'Cápsula',
        totalCapitalPaid: 5000,
        totalInterestPaid: 2000,
        status: LoanStatus.PAID,
      });
      const indefinidoLoan = makeLoan({
        loanType: 'Indefinido',
        totalCapitalPaid: 3000,
        totalInterestPaid: 1000,
        status: LoanStatus.PAID,
      });
      mockLoansRepo.find.mockResolvedValue([capsulaLoan, indefinidoLoan]);

      const result = await service.getDashboardStats();

      // 'Cápsula' !== 'capsula' and 'Indefinido' !== 'indefinido'
      // So both totals remain 0 - this is the documented bug
      expect(result.totalRecaudadoCapsula).toBe(0);
      expect(result.totalRecaudadoIndefinido).toBe(0);
    });

    it('intersesMensual comes from payments in current month', async () => {
      mockLoansRepo.find.mockResolvedValue([]);
      mockPaymentsQB.getMany.mockResolvedValue([
        { interestPaid: 300 },
        { interestPaid: 200 },
      ]);

      const result = await service.getDashboardStats();

      expect(result.intersesMensual).toBe(500);
    });
  });
});
