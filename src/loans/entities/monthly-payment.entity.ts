import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Loan } from './loan.entity';

@Entity('monthly_payments')
export class MonthlyPayment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Loan, (loan) => loan.monthlyPayments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'loan_id' })
  loan: Loan;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: Date;

  @Column({ name: 'expected_amount', type: 'integer' })
  expectedAmount: number;

  @Column({
    name: 'paid_amount',
    type: 'integer',
    default: 0,
  })
  paidAmount: number;

  @Column({
    name: 'interest_paid',
    type: 'integer',
    default: 0,
  })
  interestPaid: number;

  @Column({
    name: 'capital_paid',
    type: 'integer',
    default: 0,
  })
  capitalPaid: number;

  @Column({ name: 'is_paid', default: false })
  isPaid: boolean;

  @Column({ name: 'payment_date', type: 'date', nullable: true })
  paymentDate: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
