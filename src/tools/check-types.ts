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

// Excel analysis results: loan # (which = DB id) → should be Cápsula
const excelCapsula = new Set([
  3, 4, 11, 17, 22, 26, 27, 28, 30, 31, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42,
  43, 44, 46, 47, 48, 49, 50, 51, 54, 55, 59, 60, 61, 62, 64, 65, 66, 67, 68, 69,
  71, 72, 73, 74, 75, 76, 80, 84, 85, 86, 87, 88, 89, 92, 93, 95, 96, 99, 100,
  102, 103, 104, 105, 106, 107, 110, 111, 112, 113, 115, 118, 119, 120, 121, 122, 123, 124
]);

(async () => {
  await ds.initialize();

  const loans = await ds.query(`
    SELECT l.id, l.loan_type, l.amount, l.status, l.modality,
           c."firstName" || ' ' || c."lastName" as customer
    FROM loans l
    JOIN customers c ON l.customer_id = c.id
    ORDER BY l.id
  `);

  console.log('=== DISCREPANCIAS ENCONTRADAS ===\n');

  const shouldBeCapsula: any[] = [];
  const shouldBeIndefinido: any[] = [];

  for (const loan of loans) {
    const dbIsCapsula = loan.loan_type === 'Cápsula';
    const excelIsCapsula = excelCapsula.has(loan.id);

    if (excelIsCapsula && !dbIsCapsula) {
      shouldBeCapsula.push(loan);
    } else if (!excelIsCapsula && dbIsCapsula) {
      shouldBeIndefinido.push(loan);
    }
  }

  if (shouldBeCapsula.length > 0) {
    console.log('Deben ser CÁPSULA (DB dice Indefinido, Excel dice Cápsula):');
    for (const l of shouldBeCapsula) {
      console.log(`  id=${l.id} ${l.customer.padEnd(50)} $${Number(l.amount).toLocaleString().padStart(10)} ${l.status}`);
    }
  }

  if (shouldBeIndefinido.length > 0) {
    console.log('\nDeben ser INDEFINIDO (DB dice Cápsula, Excel dice Indefinido):');
    for (const l of shouldBeIndefinido) {
      console.log(`  id=${l.id} ${l.customer.padEnd(50)} $${Number(l.amount).toLocaleString().padStart(10)} ${l.status} mod=${l.modality}`);
    }
  }

  console.log(`\nTotal cambios: ${shouldBeCapsula.length} → Cápsula, ${shouldBeIndefinido.length} → Indefinido`);
  console.log(`Resultado: ${75 + shouldBeCapsula.length - shouldBeIndefinido.length} Cápsula + ${60 - shouldBeCapsula.length + shouldBeIndefinido.length} Indefinido = 135`);

  await ds.destroy();
})();
