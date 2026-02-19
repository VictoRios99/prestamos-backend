import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import * as ExcelJS from 'exceljs';
import * as path from 'path';

import { Customer } from './customers/entities/customer.entity';
import { Loan, LoanStatus } from './loans/entities/loan.entity';
import { Payment, PaymentType } from './payments/entities/payment.entity';
import { MonthlyPayment } from './loans/entities/monthly-payment.entity';
import {
  CashMovement,
  MovementType,
} from './cash-movements/entities/cash-movement.entity';
import { User } from './users/entities/user.entity';

// ============================================================
// CONFIGURATION
// ============================================================

const EXCEL_PATH = path.resolve(__dirname, '../../copia.xlsx');
const FIRST_DATA_ROW = 2;
const ROWS_PER_LOAN = 3;
const PAYMENT_COLS_START = 9;
const PAYMENT_COLS_END = 49;
const LIQUIDADO_COL = 50;

// ============================================================
// TYPES
// ============================================================

interface ColumnPeriod {
  col: number;
  year: number;
  month: number; // 0-11
  quincena?: 1 | 2;
}

interface ParsedPayment {
  col: number;
  period: ColumnPeriod;
  paymentDate: Date;
  interest: number;
  capital: number;
}

interface ParsedLoan {
  rowStart: number;
  code: string;
  seqId: string;
  customerName: string;
  loanDateStr: string;
  loanDate: Date;
  amount: number;
  interestRate: number; // decimal: 0.05
  monthlyInterest: number;
  isLiquidado: boolean;
  isQuincenal: boolean; // true = Capsula, false = Indefinido
  payments: ParsedPayment[];
}

// ============================================================
// COLUMN-TO-PERIOD MAPPING
// ============================================================

function buildColumnPeriods(): ColumnPeriod[] {
  const periods: ColumnPeriod[] = [];

  // Cols 9-21: Monthly, Dec 2023 - Dec 2024
  let year = 2023;
  let month = 11; // December
  for (let col = 9; col <= 21; col++) {
    periods.push({ col, year, month });
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }

  // Cols 22-49: Quincenal pairs, Jan 2025 - Feb 2026
  year = 2025;
  month = 0;
  for (let col = 22; col <= 49; col += 2) {
    periods.push({ col, year, month, quincena: 1 });
    periods.push({ col: col + 1, year, month, quincena: 2 });
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }

  return periods;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

const MESES: Record<string, number> = {
  ENERO: 0,
  FEBRERO: 1,
  MARZO: 2,
  ABRIL: 3,
  MAYO: 4,
  JUNIO: 5,
  JULIO: 6,
  AGOSTO: 7,
  SEPTIEMBRE: 8,
  SEPTIMEBRE: 8,
  OCTUBRE: 9,
  NOVIEMBRE: 10,
  NOVIMEBRE: 10,
  DICIEMBRE: 11,
};

function parseSpanishDate(text: string): Date | null {
  if (!text) return null;
  const match = text
    .toUpperCase()
    .match(/(\d{1,2})\s+DE\s+(\w+)\s+(?:DEL?\s+)?(\d{4})/);
  if (!match) return null;
  const day = parseInt(match[1]);
  const monthIdx = MESES[match[2]];
  const year = parseInt(match[3]);
  if (monthIdx === undefined || isNaN(day) || isNaN(year)) return null;
  return new Date(year, monthIdx, day);
}

function extractCellNumber(cell: ExcelJS.CellValue): number {
  if (cell === null || cell === undefined) return 0;
  if (typeof cell === 'number') return cell;
  if (typeof cell === 'string') {
    const n = parseFloat(cell.replace(/[,$]/g, ''));
    return isNaN(n) ? 0 : n;
  }
  if (typeof cell === 'object' && cell !== null) {
    if ('result' in (cell as any)) {
      const r = (cell as any).result;
      if (typeof r === 'number') return r;
      if (typeof r === 'string') {
        const n = parseFloat(r.replace(/[,$]/g, ''));
        return isNaN(n) ? 0 : n;
      }
    }
  }
  return 0;
}

function isReasonableDate(d: Date): boolean {
  const year = d.getFullYear();
  return year >= 2023 && year <= 2027;
}

function extractCellDate(cell: ExcelJS.CellValue): Date | null {
  if (cell === null || cell === undefined) return null;
  if (cell instanceof Date) return isReasonableDate(cell) ? cell : null;
  if (typeof cell === 'number') {
    const d = new Date((cell - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime()) && isReasonableDate(d)) return d;
    return null;
  }
  if (typeof cell === 'string') {
    if (cell.toUpperCase().includes('LIQUID')) return null;
    const d = new Date(cell);
    if (!isNaN(d.getTime()) && isReasonableDate(d)) return d;
    return parseSpanishDate(cell);
  }
  if (typeof cell === 'object' && cell !== null && 'result' in (cell as any)) {
    return extractCellDate((cell as any).result);
  }
  return null;
}

function extractCellString(cell: ExcelJS.CellValue): string {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'string') return cell.trim();
  if (typeof cell === 'number') return String(cell);
  if (cell instanceof Date) return cell.toISOString();
  if (typeof cell === 'object' && 'result' in (cell as any)) {
    return extractCellString((cell as any).result);
  }
  return String(cell);
}

function normalizeNameForDedup(name: string): string {
  return name
    .toUpperCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function splitMexicanName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 2) {
    return {
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || '',
    };
  }
  const lastName = parts.slice(-2).join(' ');
  const firstName = parts.slice(0, -2).join(' ');
  return { firstName, lastName };
}

function fallbackPaymentDate(period: ColumnPeriod): Date {
  if (period.quincena === 1) {
    return new Date(period.year, period.month, 15);
  }
  return new Date(period.year, period.month + 1, 0);
}

function getLastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0);
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function quincenaKey(
  year: number,
  month: number,
  q: 1 | 2 | undefined,
): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-Q${q || 0}`;
}

// ============================================================
// PARSING
// ============================================================

function parseExcel(
  ws: ExcelJS.Worksheet,
  periodMap: Map<number, ColumnPeriod>,
): { loans: ParsedLoan[]; warnings: string[] } {
  const loans: ParsedLoan[] = [];
  const warnings: string[] = [];

  for (let r = FIRST_DATA_ROW; r <= ws.rowCount; r += ROWS_PER_LOAN) {
    const fechaRow = ws.getRow(r);
    const interesRow = ws.getRow(r + 1);
    const capitalRow = ws.getRow(r + 2);

    const rowType = extractCellString(fechaRow.getCell(8).value).toUpperCase();
    if (rowType !== 'FECHA') {
      const name = extractCellString(fechaRow.getCell(3).value);
      if (name) {
        warnings.push(
          `Fila ${r}: Col H = "${rowType}" (esperado "FECHA"), nombre=${name}`,
        );
      }
      continue;
    }

    const interesType = extractCellString(
      interesRow.getCell(8).value,
    ).toUpperCase();
    const capitalType = extractCellString(
      capitalRow.getCell(8).value,
    ).toUpperCase();
    if (interesType !== 'INTERES' && interesType !== 'INTERÉS') {
      warnings.push(
        `Fila ${r + 1}: Col H = "${interesType}" (esperado "INTERES")`,
      );
    }
    if (capitalType !== 'CAPITAL') {
      warnings.push(
        `Fila ${r + 2}: Col H = "${capitalType}" (esperado "CAPITAL")`,
      );
    }

    const code = extractCellString(fechaRow.getCell(1).value);
    const seqId = extractCellString(fechaRow.getCell(2).value);
    const customerName = extractCellString(fechaRow.getCell(3).value)
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .trim();
    const loanDateStr = extractCellString(fechaRow.getCell(4).value);
    const amount = Math.round(extractCellNumber(fechaRow.getCell(5).value));
    const interestRate = extractCellNumber(fechaRow.getCell(6).value);
    const monthlyInterest = Math.round(
      extractCellNumber(fechaRow.getCell(7).value),
    );

    if (!customerName || !amount) {
      warnings.push(
        `Fila ${r}: Sin nombre o monto, saltando (nombre="${customerName}", monto=${amount})`,
      );
      continue;
    }

    const loanDate = parseSpanishDate(loanDateStr);
    if (!loanDate) {
      warnings.push(
        `Fila ${r}: No se pudo parsear fecha "${loanDateStr}", usando 2023-12-01`,
      );
    }

    const liquidadoCell = extractCellString(
      fechaRow.getCell(LIQUIDADO_COL).value,
    );
    const isLiquidado = liquidadoCell.toUpperCase().includes('LIQUID');

    // Detect quincenal pattern: check paired columns (22-49)
    let monthsWithBothQ = 0;
    let monthsWithOneQ = 0;
    for (let c = 22; c <= 49; c += 2) {
      const q1int = Math.round(extractCellNumber(interesRow.getCell(c).value));
      const q1cap = Math.round(extractCellNumber(capitalRow.getCell(c).value));
      const q2int = Math.round(
        extractCellNumber(interesRow.getCell(c + 1).value),
      );
      const q2cap = Math.round(
        extractCellNumber(capitalRow.getCell(c + 1).value),
      );
      const hasQ1 = q1int > 0 || q1cap > 0;
      const hasQ2 = q2int > 0 || q2cap > 0;
      if (hasQ1 && hasQ2) monthsWithBothQ++;
      else if (hasQ1 || hasQ2) monthsWithOneQ++;
    }
    // Quincenal if at least one month has both Q1 and Q2, and it's the majority pattern
    const isQuincenal = monthsWithBothQ > 0 && monthsWithBothQ >= monthsWithOneQ;

    // Extract payments from columns 9-49
    const payments: ParsedPayment[] = [];
    for (let c = PAYMENT_COLS_START; c <= PAYMENT_COLS_END; c++) {
      const period = periodMap.get(c);
      if (!period) continue;

      const interest = Math.round(
        extractCellNumber(interesRow.getCell(c).value),
      );
      const capital = Math.round(
        extractCellNumber(capitalRow.getCell(c).value),
      );

      if (interest === 0 && capital === 0) continue;

      let paymentDate = extractCellDate(fechaRow.getCell(c).value);
      if (!paymentDate) {
        paymentDate = fallbackPaymentDate(period);
      }

      payments.push({ col: c, period, paymentDate, interest, capital });
    }

    loans.push({
      rowStart: r,
      code,
      seqId,
      customerName,
      loanDateStr,
      loanDate: loanDate || new Date(2023, 11, 1),
      amount,
      interestRate: interestRate || 0.05,
      monthlyInterest,
      isLiquidado,
      isQuincenal,
      payments,
    });
  }

  return { loans, warnings };
}

// ============================================================
// DRY RUN REPORT
// ============================================================

function printReport(
  loans: ParsedLoan[],
  customerMap: Map<string, { name: string; loans: ParsedLoan[] }>,
  warnings: string[],
): void {
  const totalPayments = loans.reduce((sum, l) => sum + l.payments.length, 0);
  const capsulas = loans.filter((l) => l.isQuincenal);
  const indefinidos = loans.filter((l) => !l.isQuincenal);

  console.log('');
  console.log('=== RESUMEN DE PARSEO ===');
  console.log(`Prestamos encontrados: ${loans.length}`);
  console.log(
    `  Capsula (quincenal):  ${capsulas.length}`,
  );
  console.log(
    `  Indefinido (mensual): ${indefinidos.length}`,
  );
  console.log(`Clientes unicos:       ${customerMap.size}`);
  console.log(`Total pagos:           ${totalPayments}`);
  console.log(
    `Prestamos liquidados:  ${loans.filter((l) => l.isLiquidado).length}`,
  );
  console.log(
    `Prestamos activos:     ${loans.filter((l) => !l.isLiquidado).length}`,
  );
  console.log('');

  const rates = new Map<number, number>();
  for (const l of loans) {
    rates.set(l.interestRate, (rates.get(l.interestRate) || 0) + 1);
  }
  console.log('Tasas de interes:');
  for (const [rate, count] of rates) {
    console.log(`  ${(rate * 100).toFixed(0)}%: ${count} prestamos`);
  }
  console.log('');

  const totalLent = loans.reduce((s, l) => s + l.amount, 0);
  const totalInterestPaid = loans.reduce(
    (s, l) => s + l.payments.reduce((ps, p) => ps + p.interest, 0),
    0,
  );
  const totalCapitalPaid = loans.reduce(
    (s, l) => s + l.payments.reduce((ps, p) => ps + p.capital, 0),
    0,
  );
  console.log(`Total prestado:          $${totalLent.toLocaleString('es-MX')}`);
  console.log(
    `Total interes cobrado:   $${totalInterestPaid.toLocaleString('es-MX')}`,
  );
  console.log(
    `Total capital recuperado: $${totalCapitalPaid.toLocaleString('es-MX')}`,
  );
  console.log('');

  console.log('=== CLIENTES ===');
  const sortedCustomers = [...customerMap.entries()].sort((a, b) =>
    a[1].name.localeCompare(b[1].name),
  );
  for (const [, data] of sortedCustomers) {
    const loanSummary = data.loans
      .map(
        (l) =>
          `$${l.amount.toLocaleString('es-MX')} [${l.isQuincenal ? 'CAP' : 'IND'}]${l.isLiquidado ? ' (LIQ)' : ''}`,
      )
      .join(', ');
    console.log(
      `  ${data.name} -- ${data.loans.length} prestamo(s): ${loanSummary}`,
    );
  }
  console.log('');

  if (warnings.length > 0) {
    console.log(`=== ADVERTENCIAS (${warnings.length}) ===`);
    for (const w of warnings) console.log(`  * ${w}`);
    console.log('');
  }
}

// ============================================================
// MONTHLY PAYMENT GENERATION HELPERS
// ============================================================

/**
 * Generate quincenal due dates for Capsula loans.
 * Follows the same algorithm as LoansService.generateMonthlyPayments:
 * - If loan date <= 15: first due = 15th of that month
 * - If loan date > 15: first due = last day of that month
 * - Then alternate: 15th <-> last day
 */
function generateQuincenaDueDates(
  loanDate: Date,
  endDate: Date,
): Date[] {
  const dates: Date[] = [];
  const cur = new Date(loanDate);
  let lastWas15th = false;

  // First due date
  if (cur.getDate() <= 15) {
    dates.push(new Date(cur.getFullYear(), cur.getMonth(), 15));
    lastWas15th = true;
  } else {
    dates.push(getLastDayOfMonth(cur.getFullYear(), cur.getMonth()));
    lastWas15th = false;
  }

  // Generate remaining
  while (true) {
    let next: Date;
    if (lastWas15th) {
      // Next is last day of same month
      next = getLastDayOfMonth(cur.getFullYear(), cur.getMonth());
      lastWas15th = false;
    } else {
      // Next is 15th of next month
      cur.setMonth(cur.getMonth() + 1);
      next = new Date(cur.getFullYear(), cur.getMonth(), 15);
      lastWas15th = true;
    }
    if (next > endDate) break;
    dates.push(next);
  }

  return dates;
}

/**
 * Generate monthly due dates for Indefinido loans.
 * Due date = last day of each month, starting from the month after loan date.
 */
function generateMonthlyDueDates(
  loanDate: Date,
  endDate: Date,
): Date[] {
  const dates: Date[] = [];
  const cur = new Date(
    loanDate.getFullYear(),
    loanDate.getMonth() + 1,
    1,
  );

  while (cur <= endDate) {
    dates.push(getLastDayOfMonth(cur.getFullYear(), cur.getMonth()));
    cur.setMonth(cur.getMonth() + 1);
  }

  return dates;
}

/**
 * Match a payment to its closest due date within the same month.
 * For quincenal: Q1 payments match 15th, Q2 payments match last day.
 * For monthly: payments match the last day of month.
 */
function dueDateKeyForPayment(
  payment: ParsedPayment,
  isQuincenal: boolean,
): string {
  const p = payment.period;
  if (isQuincenal && p.quincena === 1) {
    return `${p.year}-${p.month}-15`;
  }
  if (isQuincenal && p.quincena === 2) {
    const lastDay = getLastDayOfMonth(p.year, p.month);
    return `${p.year}-${p.month}-${lastDay.getDate()}`;
  }
  // Monthly columns or indefinido: last day of month
  const lastDay = getLastDayOfMonth(p.year, p.month);
  return `${p.year}-${p.month}-${lastDay.getDate()}`;
}

function dueDateToKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// ============================================================
// DATABASE INSERTION
// ============================================================

async function insertData(
  loans: ParsedLoan[],
  customerMap: Map<string, { name: string; loans: ParsedLoan[] }>,
): Promise<void> {
  console.log('Iniciando importacion a la base de datos...');
  console.log('');

  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const dataSource = app.get(DataSource);
    const userRepo = dataSource.getRepository(User);
    const customerRepo = dataSource.getRepository(Customer);
    const cashMovementRepo = dataSource.getRepository(CashMovement);

    const adminUser = await userRepo.findOne({
      where: { username: 'admin' },
    });
    if (!adminUser) {
      throw new Error(
        'No se encontro el usuario admin. Ejecuta npm run seed primero.',
      );
    }

    const now = new Date();
    let createdCustomers = 0;
    let createdLoans = 0;
    let createdPayments = 0;
    let createdMonthlyPayments = 0;
    const errors: string[] = [];

    await dataSource.query(
      `ALTER TABLE "customers" ALTER COLUMN "code" SET DEFAULT ''`,
    );
    await dataSource.query(
      `ALTER TABLE "customers" ALTER COLUMN "documentNumber" SET DEFAULT ''`,
    );

    const customerEntities = new Map<string, Customer>();

    console.log('Creando clientes...');
    let customerIndex = 0;
    for (const [key, data] of customerMap) {
      customerIndex++;
      const { firstName, lastName } = splitMexicanName(data.name);
      const custCode = `CLI-${String(customerIndex).padStart(3, '0')}`;
      const customer = customerRepo.create({
        firstName,
        lastName,
        createdBy: adminUser,
        isActive: true,
      });
      const saved = await customerRepo.save(customer);
      await dataSource.query(
        `UPDATE "customers" SET "code" = $1, "documentNumber" = $2 WHERE "id" = $3`,
        [custCode, `DOC-${saved.id}`, saved.id],
      );
      customerEntities.set(key, saved);
      createdCustomers++;
    }
    console.log(`  ${createdCustomers} clientes creados`);

    console.log('Creando prestamos y pagos...');

    const allCashMovements: {
      date: Date;
      type: MovementType;
      amount: number;
      refType: string;
      refId: number;
      description: string;
    }[] = [];

    for (const parsedLoan of loans) {
      const customerKey = normalizeNameForDedup(parsedLoan.customerName);
      const customer = customerEntities.get(customerKey);
      if (!customer) {
        errors.push(
          `Fila ${parsedLoan.rowStart}: Cliente no encontrado para "${parsedLoan.customerName}"`,
        );
        continue;
      }

      const qr = dataSource.createQueryRunner();
      await qr.connect();
      await qr.startTransaction();

      try {
        // Calculate totals
        const totalInterest = parsedLoan.payments.reduce(
          (s, p) => s + p.interest,
          0,
        );
        const totalCapital = parsedLoan.payments.reduce(
          (s, p) => s + p.capital,
          0,
        );
        const currentBalance = parsedLoan.amount - totalCapital;
        const lastPayment =
          parsedLoan.payments.length > 0
            ? parsedLoan.payments.reduce((latest, p) =>
                p.paymentDate > latest.paymentDate ? p : latest,
              )
            : null;

        let status: LoanStatus;
        if (parsedLoan.isLiquidado || currentBalance <= 0) {
          status = LoanStatus.PAID;
        } else {
          status = LoanStatus.ACTIVE;
        }

        // Rate: the system stores as percentage (5 for 5%), Excel has decimal (0.05)
        const rateAsPercent = String(
          Math.round(parsedLoan.interestRate * 100 * 100) / 100,
        );

        // Determine loan type fields
        const isCapsula = parsedLoan.isQuincenal;
        const loanType = isCapsula ? 'Cápsula' : 'Indefinido';
        const modality = isCapsula ? 'quincenas' : (null as any);

        // Calculate term for Capsula
        let term: number | null = null;
        if (isCapsula) {
          // Term = total quincena payments for PAID, or quincenas from start to now for ACTIVE
          if (status === LoanStatus.PAID) {
            term = parsedLoan.payments.length;
            if (term < 2) term = 2;
          } else {
            // Count quincenas from loan start to today
            const monthsElapsed =
              (now.getFullYear() - parsedLoan.loanDate.getFullYear()) * 12 +
              (now.getMonth() - parsedLoan.loanDate.getMonth());
            term = Math.max(monthsElapsed * 2, parsedLoan.payments.length);
          }
        }

        // Create loan
        const loan = qr.manager.create(Loan, {
          customer,
          loanDate: parsedLoan.loanDate,
          amount: parsedLoan.amount,
          currentBalance:
            status === LoanStatus.PAID ? 0 : Math.max(0, currentBalance),
          totalInterestPaid: totalInterest,
          totalCapitalPaid: totalCapital,
          monthlyInterestRate: rateAsPercent,
          term: term as any,
          modality,
          loanType,
          status,
          monthsPaid: parsedLoan.payments.length,
          lastPaymentDate: lastPayment?.paymentDate || (null as any),
          createdBy: adminUser,
          notes: parsedLoan.isLiquidado
            ? 'LIQUIDADO - Importado desde Excel'
            : 'Importado desde Excel',
        });
        const savedLoan = await qr.manager.save(Loan, loan);

        // Create payments
        for (const pp of parsedLoan.payments) {
          const totalAmount = pp.interest + pp.capital;
          let paymentType: PaymentType;
          if (pp.interest > 0 && pp.capital > 0)
            paymentType = PaymentType.BOTH;
          else if (pp.capital > 0) paymentType = PaymentType.CAPITAL;
          else paymentType = PaymentType.INTEREST;

          const payment = qr.manager.create(Payment, {
            loan: savedLoan,
            paymentDate: pp.paymentDate,
            amount: totalAmount,
            paymentType,
            paymentMethod: 'CASH',
            interestPaid: pp.interest,
            capitalPaid: pp.capital,
            createdBy: adminUser,
            notes: `Importado - Col ${pp.col}`,
          });
          const savedPayment = await qr.manager.save(Payment, payment);
          createdPayments++;

          allCashMovements.push({
            date: pp.paymentDate,
            type: MovementType.PAYMENT_IN,
            amount: totalAmount,
            refType: 'payment',
            refId: savedPayment.id,
            description: `Pago de ${parsedLoan.customerName} - Prestamo $${parsedLoan.amount.toLocaleString('es-MX')}`,
          });
        }

        // ---- Create MonthlyPayments ----

        if (isCapsula) {
          // CAPSULA: generate quincenal due dates
          let endDate: Date;
          if (status === LoanStatus.PAID && lastPayment) {
            endDate = new Date(
              lastPayment.paymentDate.getFullYear(),
              lastPayment.paymentDate.getMonth(),
              lastPayment.paymentDate.getDate() + 1,
            );
          } else {
            endDate = now;
          }

          const dueDates = generateQuincenaDueDates(
            parsedLoan.loanDate,
            endDate,
          );

          // Calculate expected amount per quincena using the service's formula
          const rate = parsedLoan.interestRate; // decimal 0.05
          const numMonths = dueDates.length / 2;
          const totalToPay = Math.ceil(
            parsedLoan.amount * rate * numMonths + parsedLoan.amount,
          );
          const expectedAmount = Math.ceil(totalToPay / dueDates.length);

          // Build payment lookup by due date key
          // For monthly columns (no quincena), split across BOTH quincenas of that month
          const paymentByDueKey = new Map<
            string,
            { interest: number; capital: number; date: Date }
          >();

          for (const pp of parsedLoan.payments) {
            if (pp.period.quincena) {
              // Quincenal column: map directly to Q1 (15th) or Q2 (last day)
              const key = dueDateKeyForPayment(pp, true);
              const existing = paymentByDueKey.get(key);
              if (existing) {
                existing.interest += pp.interest;
                existing.capital += pp.capital;
                if (pp.paymentDate > existing.date)
                  existing.date = pp.paymentDate;
              } else {
                paymentByDueKey.set(key, {
                  interest: pp.interest,
                  capital: pp.capital,
                  date: new Date(pp.paymentDate),
                });
              }
            } else {
              // Monthly column: split across both quincenas of that month
              const y = pp.period.year;
              const m = pp.period.month;
              const halfInt = Math.ceil(pp.interest / 2);
              const halfCap = Math.ceil(pp.capital / 2);
              const remInt = pp.interest - halfInt;
              const remCap = pp.capital - halfCap;
              const lastDay = getLastDayOfMonth(y, m);

              const key15 = `${y}-${m}-15`;
              const keyEnd = `${y}-${m}-${lastDay.getDate()}`;

              // Q1 (15th)
              const ex1 = paymentByDueKey.get(key15);
              if (ex1) {
                ex1.interest += halfInt;
                ex1.capital += halfCap;
              } else {
                paymentByDueKey.set(key15, {
                  interest: halfInt,
                  capital: halfCap,
                  date: new Date(pp.paymentDate),
                });
              }
              // Q2 (last day)
              const ex2 = paymentByDueKey.get(keyEnd);
              if (ex2) {
                ex2.interest += remInt;
                ex2.capital += remCap;
              } else {
                paymentByDueKey.set(keyEnd, {
                  interest: remInt,
                  capital: remCap,
                  date: new Date(pp.paymentDate),
                });
              }
            }
          }

          for (const dueDate of dueDates) {
            const key = dueDateToKey(dueDate);
            const payData = paymentByDueKey.get(key);
            const isPaid = !!payData;

            const mp = qr.manager.create(MonthlyPayment, {
              loan: savedLoan,
              dueDate,
              expectedAmount,
              paidAmount: payData
                ? payData.interest + payData.capital
                : 0,
              interestPaid: payData?.interest || 0,
              capitalPaid: payData?.capital || 0,
              isPaid,
              paymentDate: payData?.date || (null as any),
            });
            await qr.manager.save(MonthlyPayment, mp);
            createdMonthlyPayments++;
          }
        } else {
          // INDEFINIDO: generate monthly due dates
          const monthlyInterestExpected = Math.ceil(
            parsedLoan.amount * parsedLoan.interestRate,
          );

          let endDate: Date;
          if (status === LoanStatus.PAID && lastPayment) {
            endDate = getLastDayOfMonth(
              lastPayment.paymentDate.getFullYear(),
              lastPayment.paymentDate.getMonth(),
            );
          } else {
            endDate = getLastDayOfMonth(now.getFullYear(), now.getMonth());
          }

          const dueDates = generateMonthlyDueDates(
            parsedLoan.loanDate,
            endDate,
          );

          // Build payment lookup by month
          const paymentsByMonth = new Map<
            string,
            { interest: number; capital: number; date: Date }
          >();
          for (const pp of parsedLoan.payments) {
            const key = monthKey(pp.period.year, pp.period.month);
            const existing = paymentsByMonth.get(key);
            if (existing) {
              existing.interest += pp.interest;
              existing.capital += pp.capital;
              if (pp.paymentDate > existing.date)
                existing.date = pp.paymentDate;
            } else {
              paymentsByMonth.set(key, {
                interest: pp.interest,
                capital: pp.capital,
                date: new Date(pp.paymentDate),
              });
            }
          }

          for (const dueDate of dueDates) {
            const key = monthKey(dueDate.getFullYear(), dueDate.getMonth());
            const monthData = paymentsByMonth.get(key);
            const isPaid = !!monthData;

            const mp = qr.manager.create(MonthlyPayment, {
              loan: savedLoan,
              dueDate,
              expectedAmount: monthlyInterestExpected,
              paidAmount: monthData
                ? monthData.interest + monthData.capital
                : 0,
              interestPaid: monthData?.interest || 0,
              capitalPaid: monthData?.capital || 0,
              isPaid,
              paymentDate: monthData?.date || (null as any),
            });
            await qr.manager.save(MonthlyPayment, mp);
            createdMonthlyPayments++;
          }
        }

        // Cash movement for loan disbursement
        allCashMovements.push({
          date: parsedLoan.loanDate,
          type: MovementType.LOAN_OUT,
          amount: parsedLoan.amount,
          refType: 'loan',
          refId: savedLoan.id,
          description: `Prestamo a ${parsedLoan.customerName} - $${parsedLoan.amount.toLocaleString('es-MX')}`,
        });

        await qr.commitTransaction();
        createdLoans++;

        if (createdLoans % 10 === 0) {
          console.log(
            `  Progreso: ${createdLoans}/${loans.length} prestamos`,
          );
        }
      } catch (err: any) {
        await qr.rollbackTransaction();
        errors.push(
          `Fila ${parsedLoan.rowStart} (${parsedLoan.customerName}): ${err.message}`,
        );
      } finally {
        await qr.release();
      }
    }

    // Phase 3: Cash movements
    console.log('Creando movimientos de caja...');
    allCashMovements.sort((a, b) => a.date.getTime() - b.date.getTime());

    let runningBalance = 0;
    let createdMovements = 0;
    for (const cm of allCashMovements) {
      if (cm.type === MovementType.LOAN_OUT) {
        runningBalance -= cm.amount;
      } else {
        runningBalance += cm.amount;
      }

      const movement = cashMovementRepo.create({
        movementDate: cm.date,
        movementType: cm.type,
        amount: cm.amount,
        balanceAfter: runningBalance,
        referenceType: cm.refType,
        referenceId: cm.refId,
        description: cm.description,
        createdBy: adminUser,
      });
      await cashMovementRepo.save(movement);
      createdMovements++;
    }

    console.log('');
    console.log('=== RESULTADO DE IMPORTACION ===');
    console.log(`Clientes creados:       ${createdCustomers}`);
    console.log(`Prestamos creados:      ${createdLoans}`);
    console.log(`Pagos creados:          ${createdPayments}`);
    console.log(`MonthlyPayments creados: ${createdMonthlyPayments}`);
    console.log(`CashMovements creados:  ${createdMovements}`);

    if (errors.length > 0) {
      console.log('');
      console.log(`ERRORES (${errors.length}):`);
      for (const e of errors) console.log(`  ${e}`);
    }

    console.log('');
    console.log('Importacion completada');
  } finally {
    await app.close();
  }
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  const executeMode = process.argv.includes('--execute');
  const columnPeriods = buildColumnPeriods();
  const periodMap = new Map<number, ColumnPeriod>();
  for (const p of columnPeriods) periodMap.set(p.col, p);

  console.log(
    executeMode
      ? 'MODO EJECUCION — Se insertaran datos en la BD'
      : 'MODO SECO — Solo analisis, sin cambios en BD',
  );
  console.log('');

  console.log('Leyendo Excel:', EXCEL_PATH);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_PATH);
  const ws = wb.worksheets[0];
  console.log(
    `  Hoja: ${ws.name}, Filas: ${ws.rowCount}, Columnas: ${ws.columnCount}`,
  );

  const { loans, warnings } = parseExcel(ws, periodMap);

  const customerMap = new Map<
    string,
    { name: string; loans: ParsedLoan[] }
  >();
  for (const loan of loans) {
    const key = normalizeNameForDedup(loan.customerName);
    if (!customerMap.has(key)) {
      customerMap.set(key, { name: loan.customerName, loans: [] });
    }
    customerMap.get(key)!.loans.push(loan);
  }

  printReport(loans, customerMap, warnings);

  if (!executeMode) {
    console.log('Ejecuta con --execute para insertar datos en la BD');
    return;
  }

  await insertData(loans, customerMap);
}

main().catch((error) => {
  console.error('Error critico:', error);
  process.exit(1);
});
