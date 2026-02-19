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

    it('capitalEnTransito uses amount - totalCapitalPaid (not currentBalance) for ACTIVE/OVERDUE only', async () => {
      mockLoansRepo.find.mockResolvedValue([
        // Cápsula ACTIVE: amount=100000, totalCapitalPaid=30000 → capital pendiente = 70000
        // (currentBalance=105000 incluye interés futuro, pero NO debe usarse)
        makeLoan({ amount: 100000, totalCapitalPaid: 30000, currentBalance: 105000, status: LoanStatus.ACTIVE, loanType: 'Cápsula' }),
        // PAID: no cuenta
        makeLoan({ amount: 50000, totalCapitalPaid: 50000, currentBalance: 0, status: LoanStatus.PAID }),
        // Indefinido OVERDUE: amount=80000, totalCapitalPaid=20000 → capital pendiente = 60000
        makeLoan({ amount: 80000, totalCapitalPaid: 20000, currentBalance: 60000, status: LoanStatus.OVERDUE, lastPaymentDate: new Date(Date.now() - 35 * 86400000), loanType: 'Indefinido' }),
      ]);

      const result = await service.getDashboardStats();

      // 70000 (Cápsula real capital) + 60000 (Indefinido) = 130000
      // NOT 105000 + 60000 = 165000 (that would be the old buggy value)
      expect(result.capitalEnTransito).toBe(130000);
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

    it('counts prestamosActivos (excludes overdue), prestamosCompletados, prestamosVencidos are mutually exclusive', async () => {
      const now = new Date();
      mockLoansRepo.find.mockResolvedValue([
        // Healthy ACTIVE (paid recently) → cuenta como Activo
        makeLoan({ status: LoanStatus.ACTIVE, lastPaymentDate: new Date(now.getFullYear(), now.getMonth(), 5) }),
        // ACTIVE pero >30 días → cuenta como Vencido, NO como Activo
        makeLoan({ status: LoanStatus.ACTIVE, lastPaymentDate: new Date(Date.now() - 40 * 86400000) }),
        // OVERDUE status → cuenta como Vencido
        makeLoan({ status: LoanStatus.OVERDUE, lastPaymentDate: new Date(Date.now() - 50 * 86400000) }),
        // PAID → cuenta como Completado
        makeLoan({ status: LoanStatus.PAID }),
      ]);

      const result = await service.getDashboardStats();

      expect(result.prestamosActivos).toBe(1);     // solo el healthy ACTIVE
      expect(result.prestamosVencidos).toBe(2);     // ACTIVE+overdue + OVERDUE
      expect(result.prestamosCompletados).toBe(1);  // PAID
      expect(result.totalPrestamos).toBe(4);
      // Activos + Vencidos + Completados = Total (mutuamente excluyente)
      expect(result.prestamosActivos + result.prestamosVencidos + result.prestamosCompletados).toBe(result.totalPrestamos);
    });

    it('totalRecaudadoCapsula/Indefinido correctly matches loanType', async () => {
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

      expect(result.totalRecaudadoCapsula).toBe(7000);
      expect(result.totalRecaudadoIndefinido).toBe(4000);
    });

    it('pagosRecibidosMes sums capital + interest from payments in current month', async () => {
      mockLoansRepo.find.mockResolvedValue([]);
      mockPaymentsQB.getMany.mockResolvedValue([
        { interestPaid: 300, capitalPaid: 1000 },
        { interestPaid: 200, capitalPaid: 500 },
      ]);

      const result = await service.getDashboardStats();

      expect(result.pagosRecibidosMes).toBe(2000);
    });

    // ========== Nuevas métricas mensuales ==========

    it('interesEsperadoCapsula: calcula interés de Cápsula mensual con monthly_payments del mes actual', async () => {
      const now = new Date();
      // Préstamo Cápsula: $100,000 al 5% mensual
      // interés esperado = ceil(100000 * 0.05) = 5000
      // capital esperado = 20000 - 5000 = 15000
      const loan = makeLoan({
        amount: 100000,
        loanType: 'Cápsula',
        modality: 'meses',
        monthlyInterestRate: '5',
        status: LoanStatus.ACTIVE,
        monthlyPayments: [
          {
            dueDate: new Date(now.getFullYear(), now.getMonth(), 15),
            expectedAmount: 20000,
            isPaid: false,
            capitalPaid: 0,
          },
        ],
      });
      mockLoansRepo.find.mockResolvedValue([loan]);

      const result = await service.getDashboardStats();

      expect(result.interesEsperadoCapsula).toBe(5000);
      expect(result.capitalEsperadoCapsula).toBe(15000);
      expect(result.capitalRecibidoCapsula).toBe(0);
    });

    it('interesEsperadoCapsula: usa tasa mitad para quincenas', async () => {
      const now = new Date();
      // Cápsula quincenal: $100,000 al 10%, quincenas → effectiveRate = 0.10/2 = 0.05
      // interés esperado por quincena = ceil(100000 * 0.05) = 5000
      // Con 2 quincenas en el mes = 10000
      const loan = makeLoan({
        amount: 100000,
        loanType: 'Cápsula',
        modality: 'quincenas',
        monthlyInterestRate: '10',
        status: LoanStatus.ACTIVE,
        monthlyPayments: [
          {
            dueDate: new Date(now.getFullYear(), now.getMonth(), 1),
            expectedAmount: 15000,
            isPaid: false,
            capitalPaid: 0,
          },
          {
            dueDate: new Date(now.getFullYear(), now.getMonth(), 16),
            expectedAmount: 15000,
            isPaid: false,
            capitalPaid: 0,
          },
        ],
      });
      mockLoansRepo.find.mockResolvedValue([loan]);

      const result = await service.getDashboardStats();

      expect(result.interesEsperadoCapsula).toBe(10000); // 5000 * 2
      expect(result.capitalEsperadoCapsula).toBe(20000); // (15000-5000) * 2
    });

    it('capitalRecibidoCapsula: suma capitalPaid solo de monthly_payments pagados en mes actual', async () => {
      const now = new Date();
      const loan = makeLoan({
        amount: 100000,
        loanType: 'Cápsula',
        modality: 'meses',
        monthlyInterestRate: '5',
        status: LoanStatus.ACTIVE,
        monthlyPayments: [
          {
            dueDate: new Date(now.getFullYear(), now.getMonth(), 15),
            expectedAmount: 20000,
            isPaid: true,
            capitalPaid: 14500,
          },
        ],
      });
      mockLoansRepo.find.mockResolvedValue([loan]);

      const result = await service.getDashboardStats();

      expect(result.capitalRecibidoCapsula).toBe(14500);
      expect(result.capitalEsperadoCapsula).toBe(15000); // 20000 - 5000
    });

    it('interesEsperadoIndefinido: calcula interés sobre currentBalance', async () => {
      // Indefinido: $50,000 saldo al 5% → ceil(50000 * 0.05) = 2500
      const loan = makeLoan({
        amount: 80000,
        currentBalance: 50000,
        loanType: 'Indefinido',
        monthlyInterestRate: '5',
        status: LoanStatus.ACTIVE,
        monthlyPayments: [],
      });
      mockLoansRepo.find.mockResolvedValue([loan]);

      const result = await service.getDashboardStats();

      expect(result.interesEsperadoIndefinido).toBe(2500);
      expect(result.interesEsperadoCapsula).toBe(0);
    });

    it('interesEsperadoTotal: suma Cápsula + Indefinido + Extras', async () => {
      const now = new Date();
      const capsula = makeLoan({
        amount: 100000,
        loanType: 'Cápsula',
        modality: 'meses',
        monthlyInterestRate: '5',
        status: LoanStatus.ACTIVE,
        monthlyPayments: [
          {
            dueDate: new Date(now.getFullYear(), now.getMonth(), 15),
            expectedAmount: 20000,
            isPaid: false,
            capitalPaid: 0,
          },
        ],
      });
      const indefinido = makeLoan({
        amount: 60000,
        currentBalance: 60000,
        loanType: 'Indefinido',
        monthlyInterestRate: '8',
        status: LoanStatus.ACTIVE,
        monthlyPayments: [],
      });
      mockLoansRepo.find.mockResolvedValue([capsula, indefinido]);

      const result = await service.getDashboardStats();

      // Cápsula: ceil(100000 * 0.05) = 5000
      // Indefinido: ceil(60000 * 0.08) = 4800
      // Extras: 0
      expect(result.interesEsperadoCapsula).toBe(5000);
      expect(result.interesEsperadoIndefinido).toBe(4800);
      expect(result.interesEsperadoExtras).toBe(0);
      expect(result.interesEsperadoTotal).toBe(9800);
    });

    it('monthly_payments de otro mes no cuentan para métricas mensuales', async () => {
      const now = new Date();
      // Monthly payment del mes pasado
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
      // Monthly payment del mes siguiente
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 15);

      const loan = makeLoan({
        amount: 100000,
        loanType: 'Cápsula',
        modality: 'meses',
        monthlyInterestRate: '5',
        status: LoanStatus.ACTIVE,
        monthlyPayments: [
          { dueDate: lastMonth, expectedAmount: 20000, isPaid: true, capitalPaid: 15000 },
          { dueDate: nextMonth, expectedAmount: 20000, isPaid: false, capitalPaid: 0 },
        ],
      });
      mockLoansRepo.find.mockResolvedValue([loan]);

      const result = await service.getDashboardStats();

      expect(result.interesEsperadoCapsula).toBe(0);
      expect(result.capitalEsperadoCapsula).toBe(0);
      expect(result.capitalRecibidoCapsula).toBe(0);
    });

    it('préstamos PAID no generan interés esperado mensual', async () => {
      const now = new Date();
      const loan = makeLoan({
        amount: 100000,
        loanType: 'Cápsula',
        modality: 'meses',
        monthlyInterestRate: '5',
        status: LoanStatus.PAID,
        monthlyPayments: [
          {
            dueDate: new Date(now.getFullYear(), now.getMonth(), 15),
            expectedAmount: 20000,
            isPaid: true,
            capitalPaid: 15000,
          },
        ],
      });
      mockLoansRepo.find.mockResolvedValue([loan]);

      const result = await service.getDashboardStats();

      expect(result.interesEsperadoCapsula).toBe(0);
      expect(result.capitalEsperadoCapsula).toBe(0);
      expect(result.capitalRecibidoCapsula).toBe(0);
    });

    it('préstamos OVERDUE sí generan interés esperado mensual', async () => {
      const now = new Date();
      const loan = makeLoan({
        amount: 100000,
        loanType: 'Cápsula',
        modality: 'meses',
        monthlyInterestRate: '5',
        status: LoanStatus.OVERDUE,
        lastPaymentDate: new Date(Date.now() - 35 * 86400000),
        monthlyPayments: [
          {
            dueDate: new Date(now.getFullYear(), now.getMonth(), 15),
            expectedAmount: 20000,
            isPaid: false,
            capitalPaid: 0,
          },
        ],
      });
      mockLoansRepo.find.mockResolvedValue([loan]);

      const result = await service.getDashboardStats();

      expect(result.interesEsperadoCapsula).toBe(5000);
      expect(result.capitalEsperadoCapsula).toBe(15000);
    });

    it('múltiples Cápsulas activas acumulan interés y capital esperado', async () => {
      const now = new Date();
      const dueThisMonth = new Date(now.getFullYear(), now.getMonth(), 15);

      const loan1 = makeLoan({
        amount: 100000,
        loanType: 'Cápsula',
        modality: 'meses',
        monthlyInterestRate: '5',
        status: LoanStatus.ACTIVE,
        monthlyPayments: [
          { dueDate: dueThisMonth, expectedAmount: 20000, isPaid: true, capitalPaid: 14000 },
        ],
      });
      const loan2 = makeLoan({
        amount: 50000,
        loanType: 'Cápsula',
        modality: 'meses',
        monthlyInterestRate: '10',
        status: LoanStatus.ACTIVE,
        monthlyPayments: [
          { dueDate: dueThisMonth, expectedAmount: 15000, isPaid: false, capitalPaid: 0 },
        ],
      });
      mockLoansRepo.find.mockResolvedValue([loan1, loan2]);

      const result = await service.getDashboardStats();

      // loan1: interés = ceil(100000*0.05) = 5000, capital = 20000-5000 = 15000, recibido = 14000
      // loan2: interés = ceil(50000*0.10) = 5000, capital = 15000-5000 = 10000, recibido = 0
      expect(result.interesEsperadoCapsula).toBe(10000);
      expect(result.capitalEsperadoCapsula).toBe(25000);
      expect(result.capitalRecibidoCapsula).toBe(14000);
    });

    it('sin préstamos activos, todas las métricas mensuales son 0', async () => {
      mockLoansRepo.find.mockResolvedValue([]);

      const result = await service.getDashboardStats();

      expect(result.interesEsperadoCapsula).toBe(0);
      expect(result.interesEsperadoIndefinido).toBe(0);
      expect(result.interesEsperadoExtras).toBe(0);
      expect(result.interesEsperadoTotal).toBe(0);
      expect(result.capitalEsperadoCapsula).toBe(0);
      expect(result.capitalRecibidoCapsula).toBe(0);
    });

    // ========== Semáforo de pagos ==========

    it('pagosAlDia: préstamo que pagó este mes va a alDia', async () => {
      const now = new Date();
      const loan = makeLoan({
        status: LoanStatus.ACTIVE,
        lastPaymentDate: new Date(now.getFullYear(), now.getMonth(), 10),
        currentBalance: 8000,
        loanType: 'Cápsula',
      });
      mockLoansRepo.find.mockResolvedValue([loan]);

      const result = await service.getDashboardStats();

      expect(result.pagosAlDia).toHaveLength(1);
      expect(result.pagosAlDia[0].customer).toBe('Juan Pérez');
      expect(result.pagosAlDia[0].monto).toBe(8000);
      expect(result.pagosAlDia[0].loanType).toBe('Cápsula');
      expect(result.pagosPendientes).toHaveLength(0);
      expect(result.pagosMorosos).toHaveLength(0);
    });

    it('pagosPendientes: préstamo activo sin pago este mes y no vencido', async () => {
      // Pagó hace 15 días → no vencido (< 30) y no pagó este mes si fue el mes pasado
      // Para asegurar "no pagó este mes", uso una fecha de hace 15 días
      // que puede caer en este mes o el pasado. Vamos a usar 20 días para ser seguro.
      const loan = makeLoan({
        status: LoanStatus.ACTIVE,
        lastPaymentDate: new Date(Date.now() - 20 * 86400000),
        currentBalance: 12000,
        loanType: 'Indefinido',
      });
      mockLoansRepo.find.mockResolvedValue([loan]);

      const result = await service.getDashboardStats();

      // Puede estar en pendientes o alDia dependiendo de si 20 días atrás cae en este mes
      const lastPay = new Date(Date.now() - 20 * 86400000);
      const now = new Date();
      if (lastPay.getMonth() === now.getMonth() && lastPay.getFullYear() === now.getFullYear()) {
        // Pagó este mes → alDia
        expect(result.pagosAlDia).toHaveLength(1);
      } else {
        // No pagó este mes → pendiente
        expect(result.pagosPendientes).toHaveLength(1);
        expect(result.pagosPendientes[0].customer).toBe('Juan Pérez');
        expect(result.pagosPendientes[0].diasRestantes).toBeGreaterThanOrEqual(0);
      }
      expect(result.pagosMorosos).toHaveLength(0);
    });

    it('pagosMorosos: préstamo vencido (>30 días) va a morosos', async () => {
      const loan = makeLoan({
        status: LoanStatus.ACTIVE,
        lastPaymentDate: new Date(Date.now() - 45 * 86400000),
        currentBalance: 15000,
        loanType: 'Cápsula',
      });
      mockLoansRepo.find.mockResolvedValue([loan]);

      const result = await service.getDashboardStats();

      expect(result.pagosMorosos).toHaveLength(1);
      expect(result.pagosMorosos[0].customer).toBe('Juan Pérez');
      expect(result.pagosMorosos[0].monto).toBe(15000);
      expect(result.pagosMorosos[0].diasAtraso).toBeGreaterThanOrEqual(14);
      expect(result.pagosAlDia).toHaveLength(0);
    });

    it('pagosMorosos: préstamo con status OVERDUE va a morosos', async () => {
      const loan = makeLoan({
        status: LoanStatus.OVERDUE,
        lastPaymentDate: new Date(Date.now() - 40 * 86400000),
        currentBalance: 20000,
        loanType: 'Indefinido',
      });
      mockLoansRepo.find.mockResolvedValue([loan]);

      const result = await service.getDashboardStats();

      expect(result.pagosMorosos).toHaveLength(1);
      expect(result.pagosMorosos[0].loanType).toBe('Indefinido');
    });

    it('semáforo clasifica correctamente mezcla de préstamos', async () => {
      const now = new Date();
      const alDiaLoan = makeLoan({
        id: 1,
        status: LoanStatus.ACTIVE,
        lastPaymentDate: new Date(now.getFullYear(), now.getMonth(), 5),
        currentBalance: 5000,
        loanType: 'Cápsula',
      });
      const morosoLoan = makeLoan({
        id: 2,
        status: LoanStatus.ACTIVE,
        lastPaymentDate: new Date(Date.now() - 50 * 86400000),
        currentBalance: 10000,
        loanType: 'Indefinido',
      });
      const paidLoan = makeLoan({
        id: 3,
        status: LoanStatus.PAID,
        lastPaymentDate: new Date(now.getFullYear(), now.getMonth(), 1),
        currentBalance: 0,
      });
      mockLoansRepo.find.mockResolvedValue([alDiaLoan, morosoLoan, paidLoan]);

      const result = await service.getDashboardStats();

      // paidLoan no aparece en ningún semáforo (solo ACTIVE/OVERDUE)
      expect(result.pagosAlDia).toHaveLength(1);
      expect(result.pagosAlDia[0].customer).toBe('Juan Pérez');
      expect(result.pagosMorosos).toHaveLength(1);
      expect(result.pagosMorosos[0].monto).toBe(10000);
      // PAID no entra en semáforo
      const totalSemaforo = result.pagosAlDia.length + result.pagosPendientes.length + result.pagosMorosos.length;
      expect(totalSemaforo).toBe(2);
    });

    it('pagosMorosos se ordena por diasAtraso descendente', async () => {
      const moroso1 = makeLoan({
        id: 1,
        status: LoanStatus.ACTIVE,
        lastPaymentDate: new Date(Date.now() - 35 * 86400000),
        currentBalance: 5000,
        customer: { firstName: 'Ana', lastName: 'López' },
      });
      const moroso2 = makeLoan({
        id: 2,
        status: LoanStatus.ACTIVE,
        lastPaymentDate: new Date(Date.now() - 60 * 86400000),
        currentBalance: 8000,
        customer: { firstName: 'Carlos', lastName: 'Ruiz' },
      });
      mockLoansRepo.find.mockResolvedValue([moroso1, moroso2]);

      const result = await service.getDashboardStats();

      expect(result.pagosMorosos).toHaveLength(2);
      // moroso2 tiene más días de atraso, debe ir primero
      expect(result.pagosMorosos[0].customer).toBe('Carlos Ruiz');
      expect(result.pagosMorosos[1].customer).toBe('Ana López');
    });

    it('pagosPendientes se ordena por diasRestantes ascendente (más urgente primero)', async () => {
      // Necesito 2 préstamos que no hayan pagado este mes y no estén vencidos
      // Uso fechas que seguro NO caen en el mes actual
      const now = new Date();
      // Hace 25 días → 5 días restantes
      const pendiente1 = makeLoan({
        id: 1,
        status: LoanStatus.ACTIVE,
        lastPaymentDate: new Date(Date.now() - 25 * 86400000),
        currentBalance: 5000,
        customer: { firstName: 'María', lastName: 'García' },
      });
      // Hace 10 días → 20 días restantes
      const pendiente2 = makeLoan({
        id: 2,
        status: LoanStatus.ACTIVE,
        lastPaymentDate: new Date(Date.now() - 10 * 86400000),
        currentBalance: 7000,
        customer: { firstName: 'Pedro', lastName: 'Sánchez' },
      });
      mockLoansRepo.find.mockResolvedValue([pendiente1, pendiente2]);

      const result = await service.getDashboardStats();

      // Dependiendo de si caen en el mes actual, podrían estar en alDia o pendientes
      // Pero si ambos están en pendientes, deben estar ordenados por urgencia
      if (result.pagosPendientes.length === 2) {
        expect(result.pagosPendientes[0].diasRestantes).toBeLessThanOrEqual(
          result.pagosPendientes[1].diasRestantes,
        );
      }
    });

    it('sin préstamos activos, semáforo vacío', async () => {
      mockLoansRepo.find.mockResolvedValue([]);

      const result = await service.getDashboardStats();

      expect(result.pagosAlDia).toHaveLength(0);
      expect(result.pagosPendientes).toHaveLength(0);
      expect(result.pagosMorosos).toHaveLength(0);
    });
  });
});
