import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

const ds = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'prestamos',
  entities: [],
});

function generateQuincenaDueDates(startDate: Date, count: number): Date[] {
  const dates: Date[] = [];
  let year = startDate.getFullYear();
  let month = startDate.getMonth();
  const startDay = startDate.getDate();

  // Determine first due date
  if (startDay <= 15) {
    // First due date is the 15th of same month (or next if too close)
    dates.push(new Date(year, month, 15));
  } else {
    // First due date is last day of same month
    const lastDay = new Date(year, month + 1, 0).getDate();
    dates.push(new Date(year, month, lastDay));
  }

  // Generate remaining dates alternating 15th / last day
  while (dates.length < count) {
    const lastDate = dates[dates.length - 1];
    const lastDay = lastDate.getDate();
    const y = lastDate.getFullYear();
    const m = lastDate.getMonth();

    if (lastDay === 15) {
      // Next is last day of same month
      const eom = new Date(y, m + 1, 0).getDate();
      dates.push(new Date(y, m, eom));
    } else {
      // Next is 15th of next month
      const nextMonth = m + 1;
      dates.push(new Date(y, nextMonth, 15));
    }
  }

  return dates;
}

(async () => {
  await ds.initialize();
  const execute = process.argv.includes('--execute');

  // === 1. Change Indefinido → Cápsula (ids: 4, 17, 22, 37) ===
  const toCapsula = [4, 17, 22, 37];
  console.log('=== Indefinido → Cápsula ===');
  for (const id of toCapsula) {
    const loan = (await ds.query(
      `SELECT l.*, c."firstName" || ' ' || c."lastName" as customer
       FROM loans l JOIN customers c ON l.customer_id = c.id WHERE l.id = $1`, [id]
    ))[0];

    console.log(`  id=${id} ${loan.customer} $${Number(loan.amount).toLocaleString()} ${loan.status}`);

    if (execute) {
      // Update loan type
      await ds.query(
        `UPDATE loans SET loan_type = 'Cápsula', modality = 'quincenas' WHERE id = $1`, [id]
      );

      // For ACTIVE loans, regenerate MonthlyPayments with quincenal schedule
      if (loan.status === 'ACTIVE') {
        // Delete existing monthly_payments
        await ds.query(`DELETE FROM monthly_payments WHERE loan_id = $1`, [id]);

        // Generate new quincenal schedule
        const loanDate = new Date(loan.loan_date);
        const rate = parseFloat(loan.monthly_interest_rate) / 100;
        const amount = Number(loan.amount);
        const dueDates = generateQuincenaDueDates(loanDate, 120); // 5 years of quincenas

        // Get existing payments to know which periods are paid
        const payments = await ds.query(
          `SELECT payment_date FROM payments WHERE loan_id = $1 ORDER BY payment_date`, [id]
        );

        let insertCount = 0;
        for (const dueDate of dueDates) {
          const interestForPeriod = Math.ceil(amount * (rate / 2));
          const isPaid = payments.some((p: any) => {
            const payDate = new Date(p.payment_date);
            // A payment covers this period if it's within 20 days before the due date
            const diff = dueDate.getTime() - payDate.getTime();
            return diff >= 0 && diff < 20 * 86400000;
          });

          await ds.query(
            `INSERT INTO monthly_payments (due_date, expected_amount, is_paid, paid_amount, loan_id, interest_paid, capital_paid)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [dueDate, interestForPeriod, isPaid, isPaid ? interestForPeriod : 0, id,
             isPaid ? interestForPeriod : 0, 0]
          );
          insertCount++;
        }
        console.log(`    → Regenerados ${insertCount} MonthlyPayments quincenales`);
      }
      console.log(`    → Actualizado a Cápsula/quincenas`);
    }
  }

  // === 2. Change Cápsula → Indefinido (ids: 82, 91) ===
  const toIndefinido = [82, 91];
  console.log('\n=== Cápsula → Indefinido ===');
  for (const id of toIndefinido) {
    const loan = (await ds.query(
      `SELECT l.*, c."firstName" || ' ' || c."lastName" as customer
       FROM loans l JOIN customers c ON l.customer_id = c.id WHERE l.id = $1`, [id]
    ))[0];

    console.log(`  id=${id} ${loan.customer} $${Number(loan.amount).toLocaleString()} ${loan.status}`);

    if (execute) {
      await ds.query(
        `UPDATE loans SET loan_type = 'Indefinido', modality = NULL, term = NULL WHERE id = $1`, [id]
      );
      console.log(`    → Actualizado a Indefinido`);
    }
  }

  // === 3. Verify ===
  if (execute) {
    const counts = await ds.query(`
      SELECT loan_type, COUNT(*) as count FROM loans GROUP BY loan_type ORDER BY loan_type
    `);
    console.log('\n=== RESULTADO FINAL ===');
    for (const c of counts) {
      console.log(`  ${c.loan_type}: ${c.count}`);
    }
  } else {
    console.log('\n⚠ Modo seco. Ejecuta con --execute para aplicar cambios.');
  }

  await ds.destroy();
})();
