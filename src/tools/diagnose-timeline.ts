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

(async () => {
  await ds.initialize();
  const now = new Date();
  const todayDay = now.getDate();
  const curMonth = now.getMonth() + 1;
  const curYear = now.getFullYear();
  console.log('Hoy:', now.toISOString().slice(0, 10), 'dia', todayDay);

  const loans = await ds.query(`
    SELECT l.id, l.loan_type, l.modality, l.amount, l.status, l.last_payment_date, l.loan_date,
           c."firstName" || ' ' || c."lastName" as customer
    FROM loans l JOIN customers c ON l.customer_id = c.id
    WHERE l.status IN ('ACTIVE', 'OVERDUE')
    ORDER BY l.id
  `);

  console.log('\n=== LOANS CLASIFICADOS COMO "AL DIA" PERO CON MPs IMPAGOS ESTE MES ===\n');
  let problemCount = 0;

  for (const loan of loans) {
    const lp = loan.last_payment_date ? new Date(loan.last_payment_date) : null;
    const paidThisMonth = lp && lp.getMonth() === now.getMonth() && lp.getFullYear() === now.getFullYear();
    const daysSince = lp ? Math.ceil((now.getTime() - lp.getTime()) / 86400000) : 9999;
    const isOverdue = daysSince > 30 || loan.status === 'OVERDUE';

    // Get this month's monthly_payments
    const mps = await ds.query(
      `SELECT id, due_date, is_paid, expected_amount FROM monthly_payments
       WHERE loan_id = $1 AND EXTRACT(MONTH FROM due_date) = $2 AND EXTRACT(YEAR FROM due_date) = $3
       ORDER BY due_date`,
      [loan.id, curMonth, curYear],
    );
    const unpaidMPs = mps.filter((m: any) => !m.is_paid);

    if (paidThisMonth && !isOverdue && unpaidMPs.length > 0) {
      problemCount++;
      console.log(
        `id=${loan.id} ${loan.customer.padEnd(40)} ${loan.loan_type.padEnd(12)} mod=${(loan.modality || '-').padEnd(10)} lastPay=${lp ? lp.toISOString().slice(0, 10) : 'null'}`,
      );
      for (const mp of mps) {
        const dd = new Date(mp.due_date);
        console.log(
          `   ${mp.is_paid ? 'PAID' : 'UNPD'} due=${dd.toISOString().slice(0, 10)} day=${dd.getDate()} amt=${mp.expected_amount}`,
        );
      }
    }
  }
  console.log(`\nTotal "Al Dia" con MPs impagos: ${problemCount}`);

  // Show all pendientes and their diasRestantes
  console.log('\n=== TODOS LOS PENDIENTES (no overdue, no paidThisMonth) ===\n');
  let pendCount = 0;
  for (const loan of loans) {
    const lp = loan.last_payment_date ? new Date(loan.last_payment_date) : null;
    const paidThisMonth = lp && lp.getMonth() === now.getMonth() && lp.getFullYear() === now.getFullYear();
    const daysSince = lp ? Math.ceil((now.getTime() - lp.getTime()) / 86400000) : 9999;
    const isOverdue = daysSince > 30 || loan.status === 'OVERDUE';

    if (!isOverdue && !paidThisMonth) {
      pendCount++;
      // Get next unpaid MP
      const nextMP = await ds.query(
        `SELECT due_date FROM monthly_payments WHERE loan_id = $1 AND is_paid = false ORDER BY due_date LIMIT 1`,
        [loan.id],
      );
      const nextDue = nextMP.length > 0 ? new Date(nextMP[0].due_date) : null;
      const diasRest = nextDue ? Math.ceil((nextDue.getTime() - now.getTime()) / 86400000) : null;

      console.log(
        `id=${loan.id} ${loan.customer.padEnd(40)} ${loan.loan_type.padEnd(12)} lastPay=${lp ? lp.toISOString().slice(0, 10) : 'null'} nextDue=${nextDue ? nextDue.toISOString().slice(0, 10) : 'null'} diasRest=${diasRest}`,
      );
    }
  }
  console.log(`Total pendientes: ${pendCount}`);

  // Show summary
  console.log('\n=== RESUMEN ===');
  let alDia = 0, pend = 0, moroso = 0;
  for (const loan of loans) {
    const lp = loan.last_payment_date ? new Date(loan.last_payment_date) : null;
    const paidThisMonth = lp && lp.getMonth() === now.getMonth() && lp.getFullYear() === now.getFullYear();
    const daysSince = lp ? Math.ceil((now.getTime() - lp.getTime()) / 86400000) : 9999;
    const isOverdue = daysSince > 30 || loan.status === 'OVERDUE';
    if (isOverdue) moroso++;
    else if (paidThisMonth) alDia++;
    else pend++;
  }
  console.log(`Al Dia: ${alDia} | Pendientes: ${pend} | Morosos: ${moroso} | Total: ${alDia + pend + moroso}`);

  await ds.destroy();
})();
