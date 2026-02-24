/**
 * fix-capsula-mps.ts
 * Reconstruye los monthly_payments de TODOS los Cápsula para que cada periodo
 * pagado tenga interés + capital combinados correctamente (no separados).
 *
 * Uso:
 *   npx ts-node -r tsconfig-paths/register src/fix-capsula-mps.ts          # Modo seco
 *   npx ts-node -r tsconfig-paths/register src/fix-capsula-mps.ts --execute # Ejecutar
 */
import { Client } from 'pg';

const EXECUTE = process.argv.includes('--execute');

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

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function main() {
  const client = new Client({
    host: 'localhost', port: 5432, user: 'victorrios', password: '', database: 'prestamos_db',
  });
  await client.connect();

  console.log(EXECUTE ? '🔴 MODO EJECUCIÓN' : '🟡 MODO SECO (usar --execute para aplicar)');
  console.log('');

  const { rows: loans } = await client.query(`
    SELECT id, amount, monthly_interest_rate, term, modality, loan_type,
           loan_date, status, total_interest_paid, total_capital_paid,
           current_balance, months_paid
    FROM loans
    WHERE loan_type = 'Cápsula'
    ORDER BY id
  `);

  console.log(`Total Cápsula loans: ${loans.length}`);
  let fixed = 0;
  let ok = 0;
  let errors = 0;
  const warnings: string[] = [];

  for (const loan of loans) {
    const amount = parseFloat(String(loan.amount));
    const rate = parseFloat(String(loan.monthly_interest_rate)) / 100;
    const term = parseInt(loan.term);
    const periodRate = loan.modality === 'quincenas' ? rate / 2 : rate;
    const interestPerPeriod = Math.ceil(amount * periodRate);
    const totalInterest = Math.ceil(amount * periodRate * term);
    const totalToPay = amount + totalInterest;
    const expectedPayment = Math.ceil(totalToPay / term);
    const capitalPerPeriod = expectedPayment - interestPerPeriod;

    // Derive correct periods paid
    let periodsPaid: number;
    if (loan.status === 'PAID') {
      periodsPaid = term;
    } else {
      const totalInt = parseFloat(String(loan.total_interest_paid));
      if (totalInt <= 0 || interestPerPeriod <= 0) {
        periodsPaid = 0;
      } else {
        periodsPaid = Math.round(totalInt / interestPerPeriod);
      }
      periodsPaid = Math.min(periodsPaid, term);
    }

    // Get current paid MP count
    const { rows: currentMps } = await client.query(
      'SELECT id, is_paid, paid_amount, interest_paid, capital_paid FROM monthly_payments WHERE loan_id = $1 ORDER BY due_date',
      [loan.id]
    );
    const currentPaidCount = currentMps.filter((m: any) => m.is_paid).length;

    // Check if MPs already have correct structure
    let needsFix = false;

    if (currentMps.length !== term) {
      needsFix = true;
    } else if (currentPaidCount !== periodsPaid) {
      needsFix = true;
    } else {
      // Check each paid MP for split issue (interest=0 or capital=0)
      for (let i = 0; i < periodsPaid; i++) {
        const mp = currentMps[i];
        const mpInt = parseFloat(mp.interest_paid || '0');
        const mpCap = parseFloat(mp.capital_paid || '0');
        if ((mpInt === 0 && mpCap > 0) || (mpCap === 0 && mpInt > 0)) {
          needsFix = true;
          break;
        }
      }
    }

    // Also check months_paid consistency
    if (parseInt(loan.months_paid) !== periodsPaid) {
      needsFix = true;
    }

    if (!needsFix) {
      ok++;
      continue;
    }

    // Get payment dates from actual payments table
    const { rows: payments } = await client.query(
      'SELECT id, payment_date FROM payments WHERE loan_id = $1 ORDER BY payment_date',
      [loan.id]
    );
    const paymentDates = payments.map((p: any) => new Date(p.payment_date));

    console.log(
      `Loan #${loan.id} [${loan.status}]: $${amount.toLocaleString()} | ` +
      `term=${term} | pago=$${expectedPayment} | ` +
      `periodsPaid=${periodsPaid} (was ${currentPaidCount} paid MPs, ${currentMps.length} total) | ` +
      `int/period=$${interestPerPeriod} cap/period=$${capitalPerPeriod}`
    );

    if (!EXECUTE) {
      fixed++;
      continue;
    }

    try {
      await client.query('BEGIN');

      // Delete old MPs
      await client.query('DELETE FROM monthly_payments WHERE loan_id = $1', [loan.id]);

      // Generate due dates
      const loanDate = new Date(loan.loan_date);
      const dueDates = loan.modality === 'quincenas'
        ? generateQuincenalDates(loanDate, term)
        : generateMensualDates(loanDate, term);

      // Create new MPs
      for (let i = 0; i < dueDates.length; i++) {
        const dueDateStr = fmtDate(dueDates[i]);
        const isPaid = i < periodsPaid;

        if (isPaid) {
          const intPaid = interestPerPeriod;
          const capPaid = capitalPerPeriod;
          const paidAmount = expectedPayment;

          // Assign payment_date: use actual payment dates if available
          let paymentDateStr: string | null = null;
          if (paymentDates.length > 0) {
            // Map period to payment: distribute payments across periods
            const payIdx = Math.min(
              Math.floor(i * paymentDates.length / periodsPaid),
              paymentDates.length - 1
            );
            paymentDateStr = fmtDate(paymentDates[payIdx]);
          }

          await client.query(
            `INSERT INTO monthly_payments (loan_id, due_date, expected_amount, is_paid, paid_amount, interest_paid, capital_paid, payment_date)
             VALUES ($1, $2, $3, true, $4, $5, $6, $7)`,
            [loan.id, dueDateStr, expectedPayment, paidAmount, intPaid, capPaid, paymentDateStr]
          );
        } else {
          await client.query(
            `INSERT INTO monthly_payments (loan_id, due_date, expected_amount, is_paid, paid_amount, interest_paid, capital_paid)
             VALUES ($1, $2, $3, false, 0, 0, 0)`,
            [loan.id, dueDateStr, expectedPayment]
          );
        }
      }

      // Update months_paid on the loan
      if (parseInt(loan.months_paid) !== periodsPaid) {
        await client.query('UPDATE loans SET months_paid = $1 WHERE id = $2', [periodsPaid, loan.id]);
      }

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
  console.log(`OK (no change): ${ok}`);
  console.log(`Errors: ${errors}`);
  if (warnings.length > 0) {
    for (const w of warnings) console.log(`  WARN: ${w}`);
  }

  // Verification
  if (EXECUTE) {
    console.log('');
    console.log('=== VERIFICACIÓN ===');
    const { rows: verify } = await client.query(`
      SELECT l.id, l.term, l.months_paid, l.status,
        (SELECT COUNT(*) FROM monthly_payments WHERE loan_id = l.id) as mp_count,
        (SELECT COUNT(*) FROM monthly_payments WHERE loan_id = l.id AND is_paid = true) as paid_mps
      FROM loans l WHERE l.loan_type = 'Cápsula' ORDER BY l.id
    `);
    let issues = 0;
    for (const v of verify) {
      const t = parseInt(v.term);
      const mc = parseInt(v.mp_count);
      const pm = parseInt(v.paid_mps);
      const mp = parseInt(v.months_paid);
      if (t !== mc) {
        console.log(`  ISSUE loan #${v.id}: term=${t} but mp_count=${mc}`);
        issues++;
      }
      if (pm !== mp) {
        console.log(`  ISSUE loan #${v.id}: paid_mps=${pm} but months_paid=${mp}`);
        issues++;
      }
    }
    if (issues === 0) {
      console.log('  All 81 Cápsula loans: term=mp_count, paid_mps=months_paid ✓');
    }

    // Check for split issues
    const { rows: splits } = await client.query(`
      SELECT mp.loan_id, COUNT(*) as cnt
      FROM monthly_payments mp
      JOIN loans l ON l.id = mp.loan_id
      WHERE l.loan_type = 'Cápsula'
        AND mp.is_paid = true
        AND CAST(mp.paid_amount AS numeric) > 0
        AND (CAST(mp.interest_paid AS numeric) = 0 OR CAST(mp.capital_paid AS numeric) = 0)
      GROUP BY mp.loan_id
    `);
    if (splits.length === 0) {
      console.log('  No split MPs (zero interest or zero capital on paid MPs) ✓');
    } else {
      for (const s of splits) {
        console.log(`  SPLIT ISSUE loan #${s.loan_id}: ${s.cnt} paid MPs with zero int or zero cap`);
      }
    }
  }

  await client.end();
}

main().catch(err => { console.error(err); process.exit(1); });
