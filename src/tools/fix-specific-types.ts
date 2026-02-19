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

function generateMonthlyDueDates(startDate: Date, count: number): Date[] {
  const dates: Date[] = [];
  const y = startDate.getFullYear();
  const m = startDate.getMonth();
  // Primera fecha: 28 del mes siguiente al préstamo
  for (let i = 1; dates.length < count; i++) {
    const d = new Date(y, m + i, 28);
    // Si el mes no tiene 28 días (imposible, todos tienen ≥28), usar último día
    dates.push(d);
  }
  return dates;
}

function generateQuincenaDueDates(startDate: Date, count: number): Date[] {
  const dates: Date[] = [];
  let year = startDate.getFullYear();
  let month = startDate.getMonth();
  const startDay = startDate.getDate();
  if (startDay <= 15) {
    dates.push(new Date(year, month, 15));
  } else {
    dates.push(new Date(year, month, new Date(year, month + 1, 0).getDate()));
  }
  while (dates.length < count) {
    const last = dates[dates.length - 1];
    const y = last.getFullYear();
    const m = last.getMonth();
    if (last.getDate() === 15) {
      dates.push(new Date(y, m, new Date(y, m + 1, 0).getDate()));
    } else {
      dates.push(new Date(y, m + 1, 15));
    }
  }
  return dates;
}

(async () => {
  await ds.initialize();
  const execute = process.argv.includes('--execute');

  // === 1. Cápsula → Indefinido: id=22 (Sergio), id=37 (Carolina) ===
  console.log('=== CAMBIOS A INDEFINIDO ===\n');
  for (const id of [22, 37]) {
    const loan = (await ds.query(
      `SELECT l.*, c."firstName" || ' ' || c."lastName" as customer
       FROM loans l JOIN customers c ON l.customer_id = c.id WHERE l.id = $1`,
      [id],
    ))[0];
    const payments = await ds.query(
      'SELECT payment_date, amount, interest_paid, capital_paid FROM payments WHERE loan_id = $1 ORDER BY payment_date',
      [id],
    );
    const amount = Number(loan.amount);
    const rate = parseFloat(loan.monthly_interest_rate) / 100;
    const monthlyInterest = Math.ceil(amount * rate);

    console.log(`id=${id} ${loan.customer} $${amount.toLocaleString()} rate=${loan.monthly_interest_rate}%`);
    console.log(`  Actual: ${loan.loan_type} mod=${loan.modality} → Cambiar a: Indefinido`);
    console.log(`  Pagos: ${payments.length} (todos $${monthlyInterest} interés, $0 capital)`);

    if (execute) {
      // Update loan type
      await ds.query(
        `UPDATE loans SET loan_type = 'Indefinido', modality = NULL, term = NULL WHERE id = $1`,
        [id],
      );

      // Delete existing quincenal MPs
      const deleted = await ds.query('DELETE FROM monthly_payments WHERE loan_id = $1', [id]);
      console.log(`  Eliminados ${deleted[1]} MPs quincenales`);

      // Generate monthly MPs (from loan_date to present + 12 months)
      const loanDate = new Date(loan.loan_date);
      const dueDates = generateMonthlyDueDates(loanDate, 36); // 3 years

      let createdCount = 0;
      for (const dueDate of dueDates) {
        // Check if there's a payment in this month
        const isPaid = payments.some((p: any) => {
          const payDate = new Date(p.payment_date);
          return payDate.getMonth() === dueDate.getMonth() && payDate.getFullYear() === dueDate.getFullYear();
        });

        await ds.query(
          `INSERT INTO monthly_payments (due_date, expected_amount, is_paid, paid_amount, loan_id, interest_paid, capital_paid)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [dueDate, monthlyInterest, isPaid, isPaid ? monthlyInterest : 0, id, isPaid ? monthlyInterest : 0, 0],
        );
        createdCount++;
      }
      console.log(`  Creados ${createdCount} MPs mensuales (${payments.length} marcados como pagados)`);
      console.log(`  → Listo: Indefinido\n`);
    }
  }

  // === 2. Indefinido → Cápsula: id=77 (Paulina) ===
  console.log('=== CAMBIO A CÁPSULA ===\n');
  const id = 77;
  const loan = (await ds.query(
    `SELECT l.*, c."firstName" || ' ' || c."lastName" as customer
     FROM loans l JOIN customers c ON l.customer_id = c.id WHERE l.id = $1`,
    [id],
  ))[0];

  const amount = Number(loan.amount); // 30000
  const rate = parseFloat(loan.monthly_interest_rate) / 100; // 0.05
  const quincenalRate = rate / 2; // 0.025
  const quincenalInterest = Math.ceil(amount * quincenalRate); // 750

  // Determinar term y capital por quincena: $30,000 → 24 quincenas, $1,250/qna
  const term = 24;
  const capitalPerQuincena = Math.ceil(amount / term); // 1250
  const expectedPayment = quincenalInterest + capitalPerQuincena; // 2000
  const totalToRepay = term * expectedPayment; // 48000

  console.log(`id=${id} ${loan.customer} $${amount.toLocaleString()} rate=${loan.monthly_interest_rate}%`);
  console.log(`  Actual: ${loan.loan_type} → Cambiar a: Cápsula quincenas`);
  console.log(`  Term: ${term} quincenas, $${capitalPerQuincena} capital + $${quincenalInterest} interés = $${expectedPayment}/qna`);
  console.log(`  Total a pagar: $${totalToRepay.toLocaleString()}`);
  console.log(`  Pagos existentes: ${loan.months_paid} ($0 pagado)`);

  if (execute) {
    // Update loan type and balance
    await ds.query(
      `UPDATE loans SET loan_type = 'Cápsula', modality = 'quincenas', term = $2, current_balance = $3 WHERE id = $1`,
      [id, term, totalToRepay],
    );

    // Delete existing monthly MPs
    const deleted = await ds.query('DELETE FROM monthly_payments WHERE loan_id = $1', [id]);
    console.log(`  Eliminados ${deleted[1]} MPs mensuales`);

    // Generate quincenal MPs
    const loanDate = new Date(loan.loan_date);
    const dueDates = generateQuincenaDueDates(loanDate, term);

    for (const dueDate of dueDates) {
      await ds.query(
        `INSERT INTO monthly_payments (due_date, expected_amount, is_paid, paid_amount, loan_id, interest_paid, capital_paid)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [dueDate, expectedPayment, false, 0, id, 0, 0],
      );
    }
    console.log(`  Creados ${term} MPs quincenales (todos impagos)`);
    console.log(`  currentBalance: $${Number(loan.current_balance).toLocaleString()} → $${totalToRepay.toLocaleString()}`);
    console.log(`  → Listo: Cápsula/quincenas\n`);
  }

  // === 3. Verify ===
  if (execute) {
    console.log('=== VERIFICACIÓN ===\n');
    for (const lid of [22, 37, 77]) {
      const l = (await ds.query(
        `SELECT l.id, l.loan_type, l.modality, l.term, l.amount, l.current_balance, l.status,
                c."firstName" || ' ' || c."lastName" as customer,
                (SELECT COUNT(*) FROM monthly_payments WHERE loan_id = l.id) as mp_count,
                (SELECT COUNT(*) FROM monthly_payments WHERE loan_id = l.id AND is_paid = true) as mp_paid
         FROM loans l JOIN customers c ON l.customer_id = c.id WHERE l.id = $1`,
        [lid],
      ))[0];
      console.log(
        `id=${l.id} ${l.customer.padEnd(40)} ${l.loan_type.padEnd(12)} mod=${(l.modality || '-').padEnd(10)} term=${l.term || '-'} ` +
        `$${Number(l.amount).toLocaleString()} bal=$${Number(l.current_balance).toLocaleString()} MPs=${l.mp_count}(${l.mp_paid} paid)`,
      );
    }

    console.log('\n=== CONTEO GLOBAL ===');
    const counts = await ds.query('SELECT loan_type, COUNT(*) as count FROM loans GROUP BY loan_type ORDER BY loan_type');
    for (const c of counts) console.log(`  ${c.loan_type}: ${c.count}`);
  } else {
    console.log('\n⚠ Modo seco. Ejecuta con --execute para aplicar.');
  }

  await ds.destroy();
})();
