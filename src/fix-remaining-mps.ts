/**
 * fix-remaining-mps.ts
 * Fix 7 Cápsula loans where MP count doesn't match term.
 * These were either skipped or already had correct term in fix-capsula-terms.ts
 */
import { Client } from 'pg';

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

async function main() {
  const client = new Client({
    host: 'localhost', port: 5432, user: 'victorrios', password: '', database: 'prestamos_db',
  });
  await client.connect();

  const loanIds = [39, 40, 44, 77, 100, 105, 106];

  for (const id of loanIds) {
    const { rows } = await client.query('SELECT * FROM loans WHERE id = $1', [id]);
    const loan = rows[0];
    const term = parseInt(loan.term);
    const amount = parseFloat(loan.amount);
    const rate = parseFloat(loan.monthly_interest_rate) / 100;
    const periodRate = loan.modality === 'quincenas' ? rate / 2 : rate;
    const totalInterest = Math.ceil(amount * periodRate * term);
    const expectedPayment = Math.ceil((amount + totalInterest) / term);

    const { rows: oldMps } = await client.query(
      'SELECT * FROM monthly_payments WHERE loan_id = $1 ORDER BY due_date', [id]
    );
    const oldPaidMps = oldMps
      .filter((m: any) => m.is_paid && parseFloat(m.paid_amount || '0') > 0)
      .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    console.log(`Loan #${id}: term=${term}, oldMPs=${oldMps.length}, paidMPs=${oldPaidMps.length}, expectedPayment=${expectedPayment}`);

    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM monthly_payments WHERE loan_id = $1', [id]);

      const loanDate = new Date(loan.loan_date);
      const dueDates = generateQuincenalDates(loanDate, term);

      for (let i = 0; i < dueDates.length; i++) {
        const d = dueDates[i];
        const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const isPaid = i < oldPaidMps.length;
        if (isPaid) {
          const old = oldPaidMps[i];
          await client.query(
            `INSERT INTO monthly_payments (loan_id, due_date, expected_amount, is_paid, paid_amount, interest_paid, capital_paid, payment_date)
             VALUES ($1, $2, $3, true, $4, $5, $6, $7)`,
            [id, ds, expectedPayment, old.paid_amount, old.interest_paid, old.capital_paid, old.payment_date]
          );
        } else {
          await client.query(
            `INSERT INTO monthly_payments (loan_id, due_date, expected_amount, is_paid, paid_amount, interest_paid, capital_paid)
             VALUES ($1, $2, $3, false, 0, 0, 0)`,
            [id, ds, expectedPayment]
          );
        }
      }
      await client.query('COMMIT');
      console.log(`  FIXED: ${term} MPs created`);
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error(`  ERROR: ${err.message}`);
    }
  }

  // Final verification — ALL Cápsula loans
  const { rows: all } = await client.query(`
    SELECT l.id, l.term,
      (SELECT COUNT(*) FROM monthly_payments WHERE loan_id = l.id) as mp_count
    FROM loans l WHERE l.loan_type = 'Cápsula' ORDER BY l.id
  `);
  let mismatches = 0;
  for (const v of all) {
    if (parseInt(v.term) !== parseInt(v.mp_count)) {
      console.log(`MISMATCH loan #${v.id}: term=${v.term}, MPs=${v.mp_count}`);
      mismatches++;
    }
  }
  console.log(`\nAll Cápsula loans: ${all.length}`);
  console.log(`Mismatches: ${mismatches}`);

  await client.end();
}

main().catch(err => { console.error(err); process.exit(1); });
