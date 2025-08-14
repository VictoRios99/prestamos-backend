import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
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

    // Entidades a eliminar
    const entities = [Payment, MonthlyPayment, Loan];
    const tableNames = entities
      .map((e) => `"${dataSource.getMetadata(e).tableName}"`)
      .join(', ');

    console.log('🧨 TRUNCATE (CASCADE) →', tableNames);
    await dataSource.query(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE;`);
    console.log('✅ Datos de Préstamos y Pagos eliminados. Los clientes no fueron modificados.');
  } catch (err: any) {
    console.error('❌ Error eliminando datos:', err.message || err);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main();
