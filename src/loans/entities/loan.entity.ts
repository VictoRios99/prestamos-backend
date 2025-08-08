import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';
import { User } from '../../users/entities/user.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { MonthlyPayment } from './monthly-payment.entity';

export enum LoanStatus {
  ACTIVE = 'ACTIVE',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED'
}

@Entity('loans')
export class Loan {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Customer, customer => customer.loans)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ name: 'loan_date', type: 'date' })
  loanDate: Date;

  @Column({ type: 'decimal', precision: 10, scale: 4 })
  amount: string;

  @Column({ name: 'current_balance', type: 'decimal', precision: 10, scale: 4, nullable: true })
  currentBalance: string;

  @Column({ name: 'total_interest_paid', type: 'decimal', precision: 10, scale: 4, default: 0 })
  totalInterestPaid: string;

  @Column({ name: 'total_capital_paid', type: 'decimal', precision: 10, scale: 4, default: 0 })
  totalCapitalPaid: string;

  @Column({ name: 'monthly_interest_rate', type: 'decimal', precision: 5, scale: 2, default: 5 })
  monthlyInterestRate: string;

  @Column({
    type: 'enum',
    enum: LoanStatus,
    default: LoanStatus.ACTIVE
  })
  status: LoanStatus;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @Column({ name: 'months_paid', type: 'integer', default: 0 })
  monthsPaid: number;

  @Column({ name: 'last_payment_date', type: 'date', nullable: true })
  lastPaymentDate: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @OneToMany(() => Payment, payment => payment.loan)
  payments: Payment[];

  @OneToMany(() => MonthlyPayment, monthlyPayment => monthlyPayment.loan)
  monthlyPayments: MonthlyPayment[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Campos calculados que no están en la BD
  interestRate: number;

  interestAmount: number;

  totalAmount: number;

  paymentFrequency: string;

  termMonths: number;
}
