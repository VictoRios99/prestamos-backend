import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { User, UserRole } from './users/entities/user.entity';
import { Customer } from './customers/entities/customer.entity';
import { Loan, LoanStatus } from './loans/entities/loan.entity';
import { Payment, PaymentType } from './payments/entities/payment.entity';
import { MonthlyPayment } from './loans/entities/monthly-payment.entity';
import { Decimal } from 'decimal.js';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  try {
    const dataSource = app.get(DataSource);
    const userRepository = dataSource.getRepository(User);
    const customerRepository = dataSource.getRepository(Customer);
    const loanRepository = dataSource.getRepository(Loan);
    const paymentRepository = dataSource.getRepository(Payment);
    const monthlyPaymentRepository = dataSource.getRepository(MonthlyPayment);

    console.log('🚀 Iniciando seed de datos...');

    // 1. Crear o verificar usuarios
    console.log('➕ Creando o verificando usuarios...');
    let adminUser = await userRepository.findOne({ where: { username: 'admin' } });
    if (!adminUser) {
      const adminPassword = await bcrypt.hash('admin123', 10);
      adminUser = userRepository.create({
        username: 'admin',
        email: 'admin@sistema.com',
        password: adminPassword,
        fullName: 'Administrador Sistema',
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      } as Partial<User>);
      await userRepository.save(adminUser);
      console.log('✅ Usuario admin creado');
    } else {
      console.log('✅ Usuario admin ya existe');
    }

    let operatorUser = await userRepository.findOne({ where: { username: 'operador' } });
    if (!operatorUser) {
      const operatorPassword = await bcrypt.hash('operator123', 10);
      operatorUser = userRepository.create({
        username: 'operador',
        email: 'operador@sistema.com',
        password: operatorPassword,
        fullName: 'Operador Uno',
        role: UserRole.OPERATOR,
        isActive: true,
      } as Partial<User>);
      await userRepository.save(operatorUser);
      console.log('✅ Usuario operador creado');
    } else {
      console.log('✅ Usuario operador ya existe');
    }

    // 2. Crear o verificar clientes
    console.log('➕ Creando o verificando clientes...');
    let customer1 = await customerRepository.findOne({ where: { documentNumber: '123456789' } });
    if (!customer1) {
      customer1 = customerRepository.create({
        code: 'CLI001',
        firstName: 'Juan',
        lastName: 'Perez',
        documentNumber: '123456789',
        phone: '111-222-3333',
        email: 'juan.perez@example.com',
        address: 'Calle Falsa 123',
        isActive: true,
        createdBy: adminUser,
      } as Partial<Customer>);
      await customerRepository.save(customer1);
      console.log('✅ Cliente Juan Perez creado');
    } else {
      console.log('✅ Cliente Juan Perez ya existe');
    }

    let customer2 = await customerRepository.findOne({ where: { documentNumber: '987654321' } });
    if (!customer2) {
      customer2 = customerRepository.create({
        code: 'CLI002',
        firstName: 'Maria',
        lastName: 'Gomez',
        documentNumber: '987654321',
        phone: '444-555-6666',
        email: 'maria.gomez@example.com',
        address: 'Avenida Siempre Viva 742',
        isActive: true,
        createdBy: operatorUser,
      } as Partial<Customer>);
      await customerRepository.save(customer2);
      console.log('✅ Cliente Maria Gomez creado');
    } else {
      console.log('✅ Cliente Maria Gomez ya existe');
    }

    // 3. Crear o verificar préstamos
    console.log('➕ Creando o verificando préstamos...');
    let loan1 = await loanRepository.findOne({ where: { customer: { id: customer1.id } } });
    if (!loan1) {
      loan1 = loanRepository.create({
        loanDate: new Date(),
        amount: new Decimal(1000).toString(),
        currentBalance: new Decimal(1000).toString(),
        totalInterestPaid: new Decimal(0).toString(),
        totalCapitalPaid: new Decimal(0).toString(),
        monthlyInterestRate: new Decimal(0.05).toString(),
        status: LoanStatus.ACTIVE,
        notes: 'Primer préstamo de Juan Perez',
        monthsPaid: 0,
        customer: customer1,
        createdBy: adminUser,
      } as Partial<Loan>);
      await loanRepository.save(loan1);
      console.log('✅ Préstamo para Juan Perez creado');
    } else {
      console.log('✅ Préstamo para Juan Perez ya existe');
    }

    let loan2 = await loanRepository.findOne({ where: { customer: { id: customer2.id } } });
    if (!loan2) {
      loan2 = loanRepository.create({
        loanDate: new Date(),
        amount: new Decimal(2500).toString(),
        currentBalance: new Decimal(2500).toString(),
        totalInterestPaid: new Decimal(0).toString(),
        totalCapitalPaid: new Decimal(0).toString(),
        monthlyInterestRate: new Decimal(0.03).toString(),
        status: LoanStatus.ACTIVE,
        notes: 'Primer préstamo de Maria Gomez',
        monthsPaid: 0,
        customer: customer2,
        createdBy: operatorUser,
      } as Partial<Loan>);
      await loanRepository.save(loan2);
      console.log('✅ Préstamo para Maria Gomez creado');
    } else {
      console.log('✅ Préstamo para Maria Gomez ya existe');
    }

    // 4. Crear o verificar pagos
    console.log('➕ Creando o verificando pagos...');
    let payment1 = await paymentRepository.findOne({ where: { loan: { id: loan1.id }, receiptNumber: 'REC001' } });
    if (!payment1) {
      payment1 = paymentRepository.create({
        loan: loan1,
        paymentDate: new Date(),
        amount: new Decimal(100).toString(),
        paymentType: PaymentType.BOTH,
        paymentMethod: 'CASH',
        receiptNumber: 'REC001',
        notes: 'Primer pago de Juan Perez',
        interestPaid: new Decimal(50).toString(),
        capitalPaid: new Decimal(50).toString(),
        createdBy: adminUser,
      } as Partial<Payment>);
      await paymentRepository.save(payment1);
      console.log('✅ Pago REC001 para Juan Perez creado');
    } else {
      console.log('✅ Pago REC001 para Juan Perez ya existe');
    }

    let payment2 = await paymentRepository.findOne({ where: { loan: { id: loan2.id }, receiptNumber: 'REC002' } });
    if (!payment2) {
      payment2 = paymentRepository.create({
        loan: loan2,
        paymentDate: new Date(),
        amount: new Decimal(150).toString(),
        paymentType: PaymentType.BOTH,
        paymentMethod: 'TRANSFER',
        receiptNumber: 'REC002',
        notes: 'Primer pago de Maria Gomez',
        interestPaid: new Decimal(75).toString(),
        capitalPaid: new Decimal(75).toString(),
        createdBy: operatorUser,
      } as Partial<Payment>);
      await paymentRepository.save(payment2);
      console.log('✅ Pago REC002 para Maria Gomez creado');
    } else {
      console.log('✅ Pago REC002 para Maria Gomez ya existe');
    }

    console.log('🎉 Seed completado exitosamente');
    console.log('👤 Admin - username: admin, password: admin123');
    console.log('👤 Operador - username: operador, password: operator123');
    
  } catch (error) {
    console.error('❌ Error en el seed:', error.message);
  } finally {
    await app.close();
  }
}

bootstrap().catch(error => {
  console.error('❌ Error crítico en el seed:', error);
  process.exit(1);
});
