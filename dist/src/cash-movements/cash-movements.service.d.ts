import { Repository, EntityManager } from 'typeorm';
import { CashMovement, MovementType } from './entities/cash-movement.entity';
export declare class CashMovementsService {
    private cashMovementRepository;
    private readonly entityManager;
    constructor(cashMovementRepository: Repository<CashMovement>, entityManager: EntityManager);
    recordMovement(type: MovementType, amount: number, description: string, userId: number, referenceType?: string, referenceId?: number, transactionalEntityManager?: EntityManager): Promise<CashMovement>;
    revertMovement(referenceType: string, referenceId: number, transactionalEntityManager: EntityManager): Promise<void>;
    getCurrentBalance(): Promise<number>;
    getMovementsByDateRange(startDate: Date, endDate: Date): Promise<CashMovement[]>;
}
