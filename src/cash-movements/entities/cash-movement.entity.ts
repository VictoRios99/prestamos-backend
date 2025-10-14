// src/cash-movements/entities/cash-movement.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum MovementType {
  LOAN_OUT = 'LOAN_OUT',
  PAYMENT_IN = 'PAYMENT_IN',
  EXPENSE = 'EXPENSE',
  DEPOSIT = 'DEPOSIT',
}

@Entity('cash_movements')
export class CashMovement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  movementDate: Date;

  @Column({
    type: 'enum',
    enum: MovementType,
  })
  movementType: MovementType;

  @Column({ type: 'integer' })
  amount: number;

  @Column({ type: 'integer' })
  balanceAfter: number;

  @Column({ nullable: true })
  referenceType: string;

  @Column({ nullable: true })
  referenceId: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @ManyToOne(() => User)
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;
}
