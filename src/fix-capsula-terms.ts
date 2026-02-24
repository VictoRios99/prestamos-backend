/**
 * fix-capsula-terms.ts
 * Script standalone para corregir el term y monthly_payments de todos los préstamos Cápsula
 * que tienen el plazo incorrecto (derivado de los totales de interés/capital pagados).
 *
 * Uso:
 *   npx ts-node -r tsconfig-paths/register src/fix-capsula-terms.ts          # Modo seco
 *   npx ts-node -r tsconfig-paths/register src/fix-capsula-terms.ts --execute # Ejecutar cambios
 */

import { Client } from 'pg';

const EXECUTE = process.argv.includes('--execute');

interface LoanRow {
  id: number;
  amount: number;
  monthly_interest_rate: string;
  term: number | null;
  modality: string;
  loan_type: string;
  loan_date: string;
  status: string;
  total_interest_paid: number;
  total_capital_paid: number;
  current_balance: number;
  months_paid: number;
}

interface MpRow {
  id: number;
  loan_id: number;
  due_date: string;
  expected_amount: string;
  is_paid: boolean;
  paid_amount: string;
  interest_paid: string;
  capital_paid: string;
  payment_date: string | null;
}

function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function generateQuincenalDates(loanDate: Date, numPayments: number): Date[] {
  const dates: Date[] = [];
  const current = new Date(loanDate);
  let lastWas15 = false;

  for (let i = 0; i < numPayments; i++) {
    let dueDate: Date;

    if (i === 0) {
      if (current.getDate() <= 15) {
        dueDate = new Date(current.getFullYear(), current.getMonth(), 15);
        lastWas15 = true;
      } else {
        const lastDay = getLastDayOfMonth(current.getFullYear(), current.getMonth());
        dueDate = new Date(current.getFullYear(), current.getMonth(), lastDay);
        lastWas15 = false;
      }
    } else {
      if (lastWas15) {
        const lastDay = getLastDayOfMonth(current.getFullYear(), current.getMonth());
        dueDate = new Date(current.getFullYear(), current.getMonth(), lastDay);
        lastWas15 = false;
      } else {
        current.setMonth(current.getMonth() + 1);
        dueDate = new Date(current.getFullYear(), current.getMonth(), 15);
        lastWas15 = true;
      }
    }
    dates.push(dueDate);
  }
  return dates;
}

function generateMensualDates(loanDate: Date, numPayments: number): Date[] {
  const dates: Date[] = [];
  const current = new Date(loanDate);
  for (let i = 0; i < numPayments; i++) {
    if (i > 0) current.setMonth(current.getMonth() + 1);
    const lastDay = getLastDayOfMonth(current.getFullYear(), current.getMonth());
    dates.push(new Date(current.getFullYear(), current.getMonth(), lastDay));
  }
  return dates;
}

async function main() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'victorrios',
    password: '',
    database: 'prestamos_db',
  });
  await client.connect();

  console.log(EXECUTE ? '🔴 MODO EJECUCIÓN' : '🟡 MODO SECO (usar --execute para aplicar)');
  console.log('');

  // 1. Fetch all Cápsula loans
  const { rows: loans } = await client.query<LoanRow>(`
    SELECT id, amount, monthly_interest_rate, term, modality, loan_type,
           loan_date, status, total_interest_paid, total_capital_paid,
           current_balance, months_paid
    FROM loans
    WHERE loan_type = 'Cápsula'
    ORDER BY id
  `);

  console.log(`Total Cápsula loans: ${loans.length}`);

  // 2. Derive correct term for each loan
  const fixes: Array<{
    loan: LoanRow;
    derivedTerm: number;
    expectedPayment: number;
    periodsPaid: number;
    totalToPay: number;
  }> = [];

  const skipped: string[] = [];
  const ok: number[] = [];

  for (const loan of loans) {
    const amount = parseFloat(String(loan.amount));
    const rate = parseFloat(String(loan.monthly_interest_rate)) / 100;
    const periodRate = loan.modality === 'quincenas' ? rate / 2 : rate;
    const interestPerPeriod = amount * periodRate;

    const totalInt = parseFloat(String(loan.total_interest_paid));
    const totalCap = parseFloat(String(loan.total_capital_paid));

    if (totalInt <= 0 || totalCap <= 0 || interestPerPeriod <= 0) {
      if (loan.status !== 'PAID' || (totalInt === 0 && totalCap === 0)) {
        skipped.push(`Loan ${loan.id} [${loan.status}]: sin pagos de interés/capital para derivar`);
      }
      continue;
    }

    // Derive periods paid from total interest
    const periodsPaidRaw = totalInt / interestPerPeriod;
    const periodsPaid = Math.round(periodsPaidRaw);

    if (periodsPaid <= 0) {
      skipped.push(`Loan ${loan.id}: periods_paid=0`);
      continue;
    }

    // Derive term from total capital
    const capitalPerPeriod = totalCap / periodsPaid;
    if (capitalPerPeriod <= 0) {
      skipped.push(`Loan ${loan.id}: capitalPerPeriod=0`);
      continue;
    }

    const termRaw = amount / capitalPerPeriod;
    const derivedTerm = Math.round(termRaw);

    if (derivedTerm <= 0 || derivedTerm > 48) {
      skipped.push(`Loan ${loan.id}: derived term=${derivedTerm} (out of range 1-48)`);
      continue;
    }

    // Safety: term must be >= periods paid
    if (derivedTerm < periodsPaid) {
      skipped.push(`Loan ${loan.id}: derived term=${derivedTerm} < periodsPaid=${periodsPaid} (data inconsistency)`);
      continue;
    }

    // Calculate expected payment for derived term
    const totalInterest = Math.ceil(amount * periodRate * derivedTerm);
    const totalToPay = amount + totalInterest;
    const expectedPayment = Math.ceil(totalToPay / derivedTerm);

    // Verify: total paid should approximately match periods_paid × expectedPayment
    const expectedTotal = periodsPaid * expectedPayment;
    const actualTotal = totalInt + totalCap;
    const diff = Math.abs(expectedTotal - actualTotal);
    const tolerance = periodsPaid * 5; // $5 per period tolerance for rounding

    if (diff > tolerance) {
      // Try nearby terms to find better match
      let bestTerm = derivedTerm;
      let bestDiff = diff;
      for (let t = derivedTerm - 2; t <= derivedTerm + 2; t++) {
        if (t <= 0 || t > 48) continue;
        const ti = Math.ceil(amount * periodRate * t);
        const tp = amount + ti;
        const ep = Math.ceil(tp / t);
        const d = Math.abs(periodsPaid * ep - actualTotal);
        if (d < bestDiff) {
          bestDiff = d;
          bestTerm = t;
        }
      }
      if (bestTerm !== derivedTerm) {
        const ti2 = Math.ceil(amount * periodRate * bestTerm);
        const tp2 = amount + ti2;
        const ep2 = Math.ceil(tp2 / bestTerm);
        fixes.push({
          loan,
          derivedTerm: bestTerm,
          expectedPayment: ep2,
          periodsPaid,
          totalToPay: tp2,
        });
      } else {
        // Accept with warning
        fixes.push({ loan, derivedTerm, expectedPayment, periodsPaid, totalToPay });
      }
      continue;
    }

    if (loan.term === derivedTerm) {
      ok.push(loan.id);
      continue;
    }

    fixes.push({ loan, derivedTerm, expectedPayment, periodsPaid, totalToPay });
  }

  console.log(`OK (no change): ${ok.length} loans`);
  console.log(`To fix: ${fixes.length} loans`);
  console.log(`Skipped: ${skipped.length} loans`);
  if (skipped.length > 0) {
    for (const s of skipped) console.log(`  SKIP: ${s}`);
  }
  console.log('');

  // 3. Show and apply fixes
  let fixed = 0;
  let errors = 0;

  for (const fix of fixes) {
    const { loan, derivedTerm, expectedPayment, periodsPaid, totalToPay } = fix;
    const oldTerm = loan.term;
    const mpCountNeeded = derivedTerm;

    console.log(
      `Loan #${loan.id} [${loan.status}]: $${parseFloat(String(loan.amount)).toLocaleString()} | ` +
      `term ${oldTerm} → ${derivedTerm} | pago=$${expectedPayment} | ` +
      `pagados=${periodsPaid}/${derivedTerm} | MPs needed=${mpCountNeeded}`
    );

    if (!EXECUTE) continue;

    try {
      await client.query('BEGIN');

      // a. Fetch existing paid MPs to preserve payment data
      const { rows: oldMps } = await client.query<MpRow>(
        `SELECT * FROM monthly_payments WHERE loan_id = $1 ORDER BY due_date`,
        [loan.id]
      );
      const oldPaidMps = oldMps
        .filter(m => m.is_paid && parseFloat(m.paid_amount || '0') > 0)
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

      // b. Delete all existing monthly_payments
      await client.query('DELETE FROM monthly_payments WHERE loan_id = $1', [loan.id]);

      // c. Generate new due dates
      const loanDate = new Date(loan.loan_date);
      const dueDates = loan.modality === 'quincenas'
        ? generateQuincenalDates(loanDate, derivedTerm)
        : generateMensualDates(loanDate, derivedTerm);

      // d. Create new monthly_payments
      for (let i = 0; i < dueDates.length; i++) {
        const dueDate = dueDates[i];
        const dueDateStr = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`;

        // Check if this period should be marked as paid
        const isPaid = i < oldPaidMps.length;

        if (isPaid) {
          const old = oldPaidMps[i];
          await client.query(
            `INSERT INTO monthly_payments (loan_id, due_date, expected_amount, is_paid, paid_amount, interest_paid, capital_paid, payment_date)
             VALUES ($1, $2, $3, true, $4, $5, $6, $7)`,
            [
              loan.id, dueDateStr, expectedPayment,
              old.paid_amount, old.interest_paid, old.capital_paid, old.payment_date,
            ]
          );
        } else {
          await client.query(
            `INSERT INTO monthly_payments (loan_id, due_date, expected_amount, is_paid, paid_amount, interest_paid, capital_paid)
             VALUES ($1, $2, $3, false, 0, 0, 0)`,
            [loan.id, dueDateStr, expectedPayment]
          );
        }
      }

      // e. Update loan term
      await client.query('UPDATE loans SET term = $1 WHERE id = $2', [derivedTerm, loan.id]);

      await client.query('COMMIT');
      fixed++;
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error(`  ERROR loan ${loan.id}: ${err.message}`);
      errors++;
    }
  }

  console.log('');
  console.log('=== RESULTADO ===');
  console.log(`Fixed: ${fixed}`);
  console.log(`Errors: ${errors}`);
  console.log(`OK (no change): ${ok.length}`);
  console.log(`Skipped: ${skipped.length}`);

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
