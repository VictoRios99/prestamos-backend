import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Loan } from '../../loans/entities/loan.entity';
import { User } from '../../users/entities/user.entity';

export enum PaymentType {
  CAPITAL = 'CAPITAL',
  INTEREST = 'INTEREST',
  BOTH = 'BOTH',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Loan, (loan) => loan.payments)
  @JoinColumn({ name: 'loan_id' })
  loan: Loan;

  @Column({ name: 'payment_date', type: 'date' })
  paymentDate: Date;

  @Column({ type: 'decimal', precision: 10, scale: 4 })
  amount: string;

  @Column({
    name: 'payment_type',
    type: 'enum',
    enum: PaymentType,
    default: PaymentType.CAPITAL,
  })
  paymentType: PaymentType;

  @Column({ name: 'payment_method', default: 'CASH' })
  paymentMethod: string;

  @Column({ name: 'receipt_number', nullable: true })
  receiptNumber: string;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @Column({
    name: 'interest_paid',
    type: 'decimal',
    precision: 10,
    scale: 4,
    default: 0,
  })
  interestPaid: string;

  @Column({
    name: 'capital_paid',
    type: 'decimal',
    precision: 10,
    scale: 4,
    default: 0,
  })
  capitalPaid: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
