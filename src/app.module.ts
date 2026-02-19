import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { User } from './users/entities/user.entity';
import { Customer } from './customers/entities/customer.entity';
import { Loan } from './loans/entities/loan.entity';
import { MonthlyPayment } from './loans/entities/monthly-payment.entity';
import { Payment } from './payments/entities/payment.entity';
import { CashMovement } from './cash-movements/entities/cash-movement.entity';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CustomersModule } from './customers/customers.module';
import { LoansModule } from './loans/loans.module';
import { PaymentsModule } from './payments/payments.module';
import { CashMovementsModule } from './cash-movements/cash-movements.module';
import { ReportsModule } from './reports/reports.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'static', 'browser'),
      serveRoot: '/',
      exclude: ['/api*'],
    }),

    ConfigModule.forRoot({ isGlobal: true }),

    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 30 }],
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: parseInt(config.get<string>('DB_PORT') ?? '5432', 10), // ✅ aquí el fix
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_DATABASE'),
        ssl:
          config.get<string>('DB_SSL') === 'true'
            ? { rejectUnauthorized: false }
            : false,
        entities: [User, Customer, Loan, MonthlyPayment, Payment, CashMovement],
        synchronize: false,
      }),
    }),

    AuthModule,
    UsersModule,
    CustomersModule,
    LoansModule,
    PaymentsModule,
    CashMovementsModule,
    ReportsModule,
    DashboardModule,
    NotificationsModule,
    TasksModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
