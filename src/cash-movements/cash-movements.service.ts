import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, EntityManager } from 'typeorm';
import { CashMovement, MovementType } from './entities/cash-movement.entity';

@Injectable()
export class CashMovementsService {
  constructor(
    @InjectRepository(CashMovement)
    private cashMovementRepository: Repository<CashMovement>,
    private readonly entityManager: EntityManager,
  ) {}

  async recordMovement(
    type: MovementType,
    amount: number,
    description: string,
    userId: number,
    referenceType?: string,
    referenceId?: number,
    transactionalEntityManager?: EntityManager,
  ): Promise<CashMovement> {
    const manager = transactionalEntityManager || this.entityManager;

    const lastMovement = await manager.findOne(CashMovement, {
      where: {},
      order: { id: 'DESC' },
      lock: { mode: 'pessimistic_write' },
    });

    let balanceAfter = lastMovement ? Number(lastMovement.balanceAfter) : 0;

    if (type === MovementType.DEPOSIT || type === MovementType.PAYMENT_IN) {
      balanceAfter += amount;
    } else {
      balanceAfter -= amount;
    }

    const movement = manager.create(CashMovement, {
      movementDate: new Date(),
      movementType: type,
      amount,
      balanceAfter,
      referenceType,
      referenceId,
      description,
      createdBy: { id: userId },
    });

    return manager.save(movement);
  }

  async revertMovement(referenceType: string, referenceId: number, transactionalEntityManager: EntityManager): Promise<void> {
    const movement = await transactionalEntityManager.findOne(CashMovement, {
      where: { referenceType, referenceId },
    });

    if (!movement) {
      throw new NotFoundException(`No se encontró movimiento de caja para revertir: ${referenceType} #${referenceId}`);
    }

    await transactionalEntityManager.remove(CashMovement, movement);

    // Aquí podrías agregar lógica para recalcular los balances si es necesario
  }

  async getCurrentBalance(): Promise<number> {
    const lastMovement = await this.cashMovementRepository.findOne({
      where: {},
      order: { id: 'DESC' },
    });
    return lastMovement ? Number(lastMovement.balanceAfter) : 0;
  }

  async getMovementsByDateRange(startDate: Date, endDate: Date) {
    return this.cashMovementRepository.find({
      where: {
        movementDate: Between(startDate, endDate),
      },
      relations: ['createdBy'],
      order: { movementDate: 'DESC' },
    });
  }
}
