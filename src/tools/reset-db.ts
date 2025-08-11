import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Loan } from '../loans/entities/loan.entity';
import { Payment } from '../payments/entities/payment.entity';
import { MonthlyPayment } from '../loans/entities/monthly-payment.entity';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const dataSource = app.get(DataSource);

    // Evita accidentes en prod
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_RESET !== 'true') {
      throw new Error('Bloqueado en producción. Exporta ALLOW_RESET=true para permitirlo.');
    }

    // En el modo 4) queremos borrar TODO, incluyendo usuarios
    const entities = [Payment, MonthlyPayment, Loan, Customer, User];
    const tableNames = entities
      .map((e) => `"${dataSource.getMetadata(e).tableName}"`)
      .join(', ');

    console.log('🧨 TRUNCATE (CASCADE) →', tableNames);
    await dataSource.query(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE;`);
    console.log('✅ Datos eliminados (incl. usuarios) e IDs reiniciados.');
  } catch (err: any) {
    console.error('❌ Error reseteando BD:', err.message || err);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main();
