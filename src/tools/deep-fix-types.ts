import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as ExcelJS from 'exceljs';
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

function getCellValue(cell: ExcelJS.Cell): number {
  if (!cell || !cell.value) return 0;
  const v = cell.value;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[,$]/g, ''));
    return isNaN(n) ? 0 : n;
  }
  if (typeof v === 'object' && 'result' in v) {
    const r = (v as any).result;
    return typeof r === 'number' ? r : 0;
  }
  return 0;
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

const QUINCENA_PAIRS: Array<{q1: number; q2: number; label: string}> = [];
const qMonths = ['Ene25','Feb25','Mar25','Abr25','May25','Jun25','Jul25','Ago25','Sep25','Oct25','Nov25','Dic25','Ene26','Feb26'];
for (let i = 0; i < 14; i++) {
  QUINCENA_PAIRS.push({ q1: 22 + i*2, q2: 23 + i*2, label: qMonths[i] });
}

(async () => {
  await ds.initialize();
  const execute = process.argv.includes('--execute');

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('/Users/victorrios/Desktop/personal/prestamos/copia.xlsx');
  const ws = wb.getWorksheet(1)!;

  interface ExcelLoan {
    seqNum: number;
    name: string;
    amount: number;
    rate: number;
    hasQ1Q2: boolean;
    q1q2Months: string[];
    totalPaymentPeriods: number;
    periodsWithCapital: number;
    capitalRatio: number;
    capitalAmounts: number[];
    totalCapitalPaid: number;
    classification: 'Cápsula' | 'Indefinido';
    reason: string;
  }

  const excelLoans: ExcelLoan[] = [];
  let seqNum = 0;

  for (let row = 2; row <= ws.rowCount; row += 3) {
    const fechaRow = ws.getRow(row);
    const interesRow = ws.getRow(row + 1);
    const capitalRow = ws.getRow(row + 2);

    const rowType = String(fechaRow.getCell(8).value || '').trim().toUpperCase();
    if (rowType !== 'FECHA') continue;

    seqNum++;
    const name = String(fechaRow.getCell(3).value || '').trim();
    const amount = getCellValue(fechaRow.getCell(5));
    const rate = getCellValue(fechaRow.getCell(6));

    if (!name || amount <= 0) {
      excelLoans.push({
        seqNum, name: name || '(vacío)', amount, rate,
        hasQ1Q2: false, q1q2Months: [],
        totalPaymentPeriods: 0, periodsWithCapital: 0, capitalRatio: 0,
        capitalAmounts: [], totalCapitalPaid: 0,
        classification: 'Indefinido', reason: 'sin datos',
      });
      continue;
    }

    // Check Q1+Q2 pattern
    let hasQ1Q2 = false;
    const q1q2Months: string[] = [];
    for (const pair of QUINCENA_PAIRS) {
      const q1i = getCellValue(interesRow.getCell(pair.q1));
      const q2i = getCellValue(interesRow.getCell(pair.q2));
      if (q1i > 0 && q2i > 0) {
        hasQ1Q2 = true;
        q1q2Months.push(pair.label);
      }
    }

    // Check capital payments
    let totalPaymentPeriods = 0;
    let periodsWithCapital = 0;
    const capitalAmounts: number[] = [];

    for (let col = 9; col <= 21; col++) {
      const interest = getCellValue(interesRow.getCell(col));
      const capital = getCellValue(capitalRow.getCell(col));
      if (interest > 0 || capital > 0) {
        totalPaymentPeriods++;
        if (capital > 0) {
          periodsWithCapital++;
          capitalAmounts.push(capital);
        }
      }
    }
    for (let col = 22; col <= 49; col++) {
      const interest = getCellValue(interesRow.getCell(col));
      const capital = getCellValue(capitalRow.getCell(col));
      if (interest > 0 || capital > 0) {
        totalPaymentPeriods++;
        if (capital > 0) {
          periodsWithCapital++;
          capitalAmounts.push(capital);
        }
      }
    }

    const capitalRatio = totalPaymentPeriods > 0 ? periodsWithCapital / totalPaymentPeriods : 0;
    const totalCapitalPaid = capitalAmounts.reduce((s, c) => s + c, 0);

    // Check if capital is regular (consistent small amounts vs lump sum payoff)
    const isLumpSumPayoff = capitalAmounts.length <= 2 && totalCapitalPaid >= amount * 0.8;

    // Check if capital amount matches expected Cápsula formula
    // Cápsula terms: $5k→8qnas($625), $10k→10qnas($1000) or 16qnas($625),
    //               $15k→24qnas($625), $20k→24qnas($834)
    const expectedCapsulaAmounts: Record<number, number[]> = {
      5000: [625],
      10000: [1000, 625],
      15000: [625],
      20000: [834, 833, 849],
      30000: [1250],
      40000: [1667],
    };
    const possibleAmounts = expectedCapsulaAmounts[amount] || [];
    const matchesCapsulaFormula = capitalAmounts.length > 0 &&
      capitalAmounts.some(c => possibleAmounts.some(p => Math.abs(c - p) <= 2));

    // Regular capital = at least 3 consistent payments
    let isRegularCapital = false;
    if (capitalAmounts.length >= 3) {
      const sorted = [...capitalAmounts].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      if (median > 0) {
        const regular = capitalAmounts.filter(a => Math.abs(a - median) / median < 0.3).length;
        isRegularCapital = regular / capitalAmounts.length > 0.6;
      }
    }

    // Classification
    let classification: 'Cápsula' | 'Indefinido';
    let reason: string;

    if (hasQ1Q2) {
      classification = 'Cápsula';
      reason = `Q1+Q2: ${q1q2Months.join(',')}`;
    } else if (isRegularCapital && capitalRatio >= 0.5 && !isLumpSumPayoff) {
      classification = 'Cápsula';
      reason = `Capital regular: ${capitalAmounts.slice(0,5).join(',')} (${periodsWithCapital}/${totalPaymentPeriods})`;
    } else if (matchesCapsulaFormula && capitalRatio >= 0.5 && !isLumpSumPayoff) {
      classification = 'Cápsula';
      reason = `Capital match fórmula: ${capitalAmounts.slice(0,5).join(',')} (${periodsWithCapital}/${totalPaymentPeriods})`;
    } else if (matchesCapsulaFormula && totalPaymentPeriods <= 2 && capitalAmounts.length > 0 && !isLumpSumPayoff) {
      // New loan with 1-2 payments but capital matches Cápsula pattern
      classification = 'Cápsula';
      reason = `Nuevo, capital=$${capitalAmounts[0]} match fórmula Cápsula`;
    } else {
      classification = 'Indefinido';
      if (isLumpSumPayoff) {
        reason = `Liquidación lump-sum: $${totalCapitalPaid.toLocaleString()} de $${amount.toLocaleString()}`;
      } else if (capitalAmounts.length === 0) {
        reason = `Sin pagos a capital`;
      } else {
        reason = `Capital irregular/esporádico: [${capitalAmounts.slice(0,5).join(',')}] ratio=${Math.round(capitalRatio*100)}%`;
      }
    }

    excelLoans.push({
      seqNum, name, amount, rate,
      hasQ1Q2, q1q2Months,
      totalPaymentPeriods, periodsWithCapital, capitalRatio,
      capitalAmounts, totalCapitalPaid,
      classification, reason,
    });
  }

  // Get current DB state
  const dbLoans = await ds.query(`
    SELECT l.id, l.loan_type, l.amount, l.status, l.modality, l.loan_date,
           l.monthly_interest_rate,
           c."firstName" || ' ' || c."lastName" as customer
    FROM loans l
    JOIN customers c ON l.customer_id = c.id
    ORDER BY l.id
  `);

  const mismatches: Array<{dbId: number; dbType: string; excelType: string; customer: string; amount: number; status: string; reason: string}> = [];

  for (const exLoan of excelLoans) {
    const dbLoan = dbLoans.find((d: any) => d.id === exLoan.seqNum);
    if (!dbLoan) continue;

    if (dbLoan.loan_type !== exLoan.classification) {
      mismatches.push({
        dbId: dbLoan.id,
        dbType: dbLoan.loan_type,
        excelType: exLoan.classification,
        customer: dbLoan.customer,
        amount: Number(dbLoan.amount),
        status: dbLoan.status,
        reason: exLoan.reason,
      });
    }
  }

  // Also show all current Indefinido loans with their Excel analysis
  console.log('=== ANÁLISIS COMPLETO DE INDEFINIDOS EN DB ===\n');
  const currentIndefinido = dbLoans.filter((d: any) => d.loan_type === 'Indefinido');
  for (const dbLoan of currentIndefinido) {
    const exLoan = excelLoans.find(e => e.seqNum === dbLoan.id);
    if (!exLoan) continue;
    const marker = exLoan.classification === 'Cápsula' ? '⚠ CAMBIAR' : '  OK';
    console.log(`${marker} id=${String(dbLoan.id).padStart(3)} ${dbLoan.customer.padEnd(45)} $${Number(dbLoan.amount).toLocaleString().padStart(10)} ${dbLoan.status.padEnd(6)} | ${exLoan.reason}`);
  }

  console.log(`\nExcel: ${excelLoans.filter(l => l.classification === 'Cápsula').length} Cápsula, ${excelLoans.filter(l => l.classification === 'Indefinido').length} Indefinido`);
  console.log(`DB:    ${dbLoans.filter((l: any) => l.loan_type === 'Cápsula').length} Cápsula, ${dbLoans.filter((l: any) => l.loan_type === 'Indefinido').length} Indefinido`);

  if (mismatches.length > 0) {
    console.log(`\n=== ${mismatches.length} CAMBIOS NECESARIOS ===\n`);
    const toCapsula = mismatches.filter(m => m.excelType === 'Cápsula');
    const toIndefinido = mismatches.filter(m => m.excelType === 'Indefinido');

    if (toCapsula.length > 0) {
      console.log('→ Cambiar a CÁPSULA:');
      for (const m of toCapsula) {
        console.log(`  id=${String(m.dbId).padStart(3)} ${m.customer.padEnd(45)} $${m.amount.toLocaleString().padStart(10)} ${m.status.padEnd(6)} | ${m.reason}`);
      }
    }
    if (toIndefinido.length > 0) {
      console.log('\n→ Cambiar a INDEFINIDO:');
      for (const m of toIndefinido) {
        console.log(`  id=${String(m.dbId).padStart(3)} ${m.customer.padEnd(45)} $${m.amount.toLocaleString().padStart(10)} ${m.status.padEnd(6)} | ${m.reason}`);
      }
    }
  }

  if (execute && mismatches.length > 0) {
    console.log('\n=== APLICANDO CORRECCIONES ===\n');
    for (const m of mismatches) {
      if (m.excelType === 'Cápsula') {
        await ds.query(`UPDATE loans SET loan_type = 'Cápsula', modality = 'quincenas' WHERE id = $1`, [m.dbId]);

        if (m.status === 'ACTIVE' || m.status === 'OVERDUE') {
          await ds.query(`DELETE FROM monthly_payments WHERE loan_id = $1`, [m.dbId]);
          const dbLoan = dbLoans.find((d: any) => d.id === m.dbId);
          const loanDate = new Date(dbLoan.loan_date);
          const rate = parseFloat(dbLoan.monthly_interest_rate) / 100;
          const dueDates = generateQuincenaDueDates(loanDate, 120);
          const payments = await ds.query(
            `SELECT payment_date FROM payments WHERE loan_id = $1 ORDER BY payment_date`, [m.dbId]
          );
          for (const dueDate of dueDates) {
            const interestForPeriod = Math.ceil(m.amount * (rate / 2));
            const isPaid = payments.some((p: any) => {
              const payDate = new Date(p.payment_date);
              const diff = dueDate.getTime() - payDate.getTime();
              return diff >= -5 * 86400000 && diff < 20 * 86400000;
            });
            await ds.query(
              `INSERT INTO monthly_payments (due_date, expected_amount, is_paid, paid_amount, loan_id, interest_paid, capital_paid)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [dueDate, interestForPeriod, isPaid, isPaid ? interestForPeriod : 0, m.dbId, isPaid ? interestForPeriod : 0, 0]
            );
          }
          console.log(`  id=${m.dbId} → Cápsula + regenerados MonthlyPayments`);
        } else {
          console.log(`  id=${m.dbId} → Cápsula (${m.status})`);
        }
      } else {
        await ds.query(`UPDATE loans SET loan_type = 'Indefinido', modality = NULL, term = NULL WHERE id = $1`, [m.dbId]);
        console.log(`  id=${m.dbId} → Indefinido`);
      }
    }

    const counts = await ds.query(`SELECT loan_type, COUNT(*) as count FROM loans GROUP BY loan_type ORDER BY loan_type`);
    console.log('\n=== RESULTADO FINAL ===');
    for (const c of counts) console.log(`  ${c.loan_type}: ${c.count}`);
  } else if (!execute) {
    console.log('\n⚠ Modo seco. Ejecuta con --execute para aplicar.');
  }

  await ds.destroy();
})();
