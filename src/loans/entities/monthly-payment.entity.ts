import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Loan } from './loan.entity';

@Entity('monthly_payments')
export class MonthlyPayment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Loan, loan => loan.monthlyPayments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'loan_id' })
  loan: Loan;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: Date;

  @Column({ name: 'expected_amount', type: 'decimal', precision: 10, scale: 4 })
  expectedAmount: string;

  @Column({ name: 'paid_amount', type: 'decimal', precision: 10, scale: 4, default: 0 })
  paidAmount: string;

  @Column({ name: 'interest_paid', type: 'decimal', precision: 10, scale: 4, default: 0 })
  interestPaid: string;

  @Column({ name: 'capital_paid', type: 'decimal', precision: 10, scale: 4, default: 0 })
  capitalPaid: string;

  @Column({ name: 'is_paid', default: false })
  isPaid: boolean;

  @Column({ name: 'payment_date', type: 'date', nullable: true })
  paymentDate: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
