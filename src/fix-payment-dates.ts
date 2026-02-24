/**
 * fix-payment-dates.ts
 *
 * Corrige 4 pagos importados desde Excel que tienen año 2025 en vez de 2026.
 * El error está en el Excel original (celdas FECHA con 2025 en cols 48-49 que
 * corresponden a Feb 2026). Los pagos existen en la DB pero con fecha incorrecta,
 * causando que no se contabilicen en el dashboard de Feb 2026.
 *
 * Pagos a corregir:
 *   Payment 1193 (Loan 110, Col 49): 2025-02-16 → 2026-02-16
 *   Payment 1200 (Loan 111, Col 49): 2025-02-16 → 2026-02-16
 *   Payment 1228 (Loan 118, Col 48): 2025-02-10 → 2026-02-10
 *   Payment 1234 (Loan 119, Col 49): 2025-02-16 → 2026-02-16
 *
 * También corrige las cash_movements asociadas y lastPaymentDate de los loans.
 *
 * Uso:
 *   npx ts-node -r tsconfig-paths/register src/fix-payment-dates.ts           # modo seco
 *   npx ts-node -r tsconfig-paths/register src/fix-payment-dates.ts --execute  # ejecutar
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import { Payment } from './payments/entities/payment.entity';
import { Loan } from './loans/entities/loan.entity';
import { CashMovement } from './cash-movements/entities/cash-movement.entity';

interface FixEntry {
  paymentId: number;
  loanId: number;
  oldDate: string; // YYYY-MM-DD
  newDate: string; // YYYY-MM-DD
  description: string;
}

const FIXES: FixEntry[] = [
  {
    paymentId: 1193,
    loanId: 110,
    oldDate: '2025-02-16',
    newDate: '2026-02-16',
    description: 'ANA KARINA TREJO RIVERA (Col 49)',
  },
  {
    paymentId: 1200,
    loanId: 111,
    oldDate: '2025-02-16',
    newDate: '2026-02-16',
    description: 'FABIOLA GARCÍA ALVARADO (Col 49)',
  },
  {
    paymentId: 1228,
    loanId: 118,
    oldDate: '2025-02-10',
    newDate: '2026-02-10',
    description: 'ELIZABETH TREVIZO RIVERA (Col 48)',
  },
  {
    paymentId: 1234,
    loanId: 119,
    oldDate: '2025-02-16',
    newDate: '2026-02-16',
    description: 'ADRIANA MARGARITA HERNANDEZ CARRILO (Col 49)',
  },
];

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const execute = process.argv.includes('--execute');

  try {
    const ds = app.get(DataSource);
    const paymentRepo = ds.getRepository(Payment);
    const loanRepo = ds.getRepository(Loan);
    const cashRepo = ds.getRepository(CashMovement);

    console.log(execute ? '=== MODO EJECUCIÓN ===' : '=== MODO SECO ===');
    console.log(`${FIXES.length} pagos a corregir\n`);

    for (const fix of FIXES) {
      console.log(`--- Payment #${fix.paymentId} (Loan #${fix.loanId}) ---`);
      console.log(`  ${fix.description}`);

      // Verify payment exists with expected old date
      const payment = await paymentRepo.findOne({
        where: { id: fix.paymentId },
        relations: ['loan'],
      });

      if (!payment) {
        console.log(`  ⚠ Payment not found! Skipping.`);
        continue;
      }

      const currentDate = payment.paymentDate?.toString().slice(0, 10) || '';
      if (!currentDate.startsWith(fix.oldDate.slice(0, 7))) {
        console.log(
          `  ⚠ Date mismatch: expected ~${fix.oldDate}, got ${currentDate}. Skipping.`,
        );
        continue;
      }

      console.log(`  Payment: ${currentDate} → ${fix.newDate}`);

      // Find associated cash_movement (PAYMENT_IN with same loan and similar date)
      const cashMovements = await cashRepo
        .createQueryBuilder('cm')
        .where('cm.description LIKE :desc', {
          desc: `%Loan #${fix.loanId}%`,
        })
        .andWhere('cm.movementDate >= :start', { start: `${fix.oldDate.slice(0, 7)}-01` })
        .andWhere('cm.movementDate <= :end', { end: `${fix.oldDate.slice(0, 7)}-28` })
        .getMany();

      if (cashMovements.length > 0) {
        for (const cm of cashMovements) {
          const cmDate =
            cm.movementDate instanceof Date
              ? cm.movementDate.toISOString().slice(0, 10)
              : String(cm.movementDate).slice(0, 10);
          console.log(
            `  CashMovement #${cm.id}: ${cmDate} → ${fix.newDate} (${cm.description?.slice(0, 50)})`,
          );
        }
      } else {
        // Try broader search
        const allCm = await cashRepo
          .createQueryBuilder('cm')
          .where('cm.movementDate >= :start', { start: `${fix.oldDate.slice(0, 7)}-01` })
          .andWhere('cm.movementDate <= :end', { end: `${fix.oldDate.slice(0, 7)}-28` })
          .andWhere('cm.description LIKE :desc', {
            desc: `%#${fix.loanId}%`,
          })
          .getMany();
        if (allCm.length > 0) {
          for (const cm of allCm) {
            console.log(
              `  CashMovement #${cm.id}: found via broader search`,
            );
          }
        } else {
          console.log(`  No matching cash_movements found`);
        }
      }

      // Check if this payment is the latest for the loan
      const loan = await loanRepo.findOne({ where: { id: fix.loanId } });
      const loanLastDate = loan?.lastPaymentDate?.toString().slice(0, 10) || '';
      const allLoanPayments = await paymentRepo.find({
        where: { loan: { id: fix.loanId } },
        order: { paymentDate: 'DESC' },
      });

      // After fixing, what would be the latest payment date?
      const datesAfterFix = allLoanPayments.map((p) => {
        if (p.id === fix.paymentId) return fix.newDate;
        return p.paymentDate?.toString().slice(0, 10) || '';
      });
      const newLastDate = datesAfterFix.sort().reverse()[0];

      if (newLastDate !== loanLastDate) {
        console.log(
          `  Loan #${fix.loanId} lastPaymentDate: ${loanLastDate} → ${newLastDate}`,
        );
      }

      if (execute) {
        await ds.transaction(async (em) => {
          // Fix payment date
          await em
            .createQueryBuilder()
            .update(Payment)
            .set({ paymentDate: fix.newDate as any })
            .where('id = :id', { id: fix.paymentId })
            .execute();

          // Fix cash_movements
          for (const cm of cashMovements) {
            await em
              .createQueryBuilder()
              .update(CashMovement)
              .set({ movementDate: new Date(fix.newDate) })
              .where('id = :id', { id: cm.id })
              .execute();
          }

          // Fix loan lastPaymentDate if needed
          if (newLastDate !== loanLastDate) {
            await em
              .createQueryBuilder()
              .update(Loan)
              .set({ lastPaymentDate: newLastDate as any })
              .where('id = :id', { id: fix.loanId })
              .execute();
          }
        });
        console.log(`  ✓ Fixed!`);
      }
      console.log();
    }

    // Verify totals after fix
    if (execute) {
      console.log('=== VERIFICACIÓN ===');
      const febPayments = await paymentRepo
        .createQueryBuilder('p')
        .where("p.paymentDate >= '2026-02-01'")
        .andWhere("p.paymentDate <= '2026-02-28'")
        .getMany();

      let totalInt = 0;
      let totalCap = 0;
      for (const p of febPayments) {
        totalInt += Number(p.interestPaid || 0);
        totalCap += Number(p.capitalPaid || 0);
      }

      console.log(`Feb 2026 payments: ${febPayments.length}`);
      console.log(
        `  Interés: $${totalInt.toLocaleString()} (Excel: $88,746.70)`,
      );
      console.log(
        `  Capital: $${totalCap.toLocaleString()} (Excel: $48,673.92)`,
      );
      console.log(
        `  Total:   $${(totalInt + totalCap).toLocaleString()} (Excel: $137,420.62)`,
      );
      console.log(
        `  Diferencia: $${Math.abs(totalInt + totalCap - 137420.62).toFixed(2)} (redondeo decimales→enteros)`,
      );
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
