import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { CashMovementsService } from './cash-movements.service';
import { CashMovement, MovementType } from './entities/cash-movement.entity';

describe('CashMovementsService', () => {
  let service: CashMovementsService;
  let mockRepo: Record<string, jest.Mock>;
  let mockEntityManager: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockRepo = { findOne: jest.fn() };

    mockEntityManager = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((_cls: any, data: any) => ({ ...data })),
      save: jest.fn().mockImplementation(async (entity: any) => ({ id: 1, ...entity })),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CashMovementsService,
        { provide: getRepositoryToken(CashMovement), useValue: mockRepo },
        { provide: EntityManager, useValue: mockEntityManager },
      ],
    }).compile();

    service = module.get<CashMovementsService>(CashMovementsService);
  });

  describe('recordMovement', () => {
    it('PAYMENT_IN increments balance from 0 when no previous movements', async () => {
      mockEntityManager.findOne.mockResolvedValue(null);

      const result = await service.recordMovement(
        MovementType.PAYMENT_IN, 1000, 'Pago recibido', 1,
      );

      expect(result.balanceAfter).toBe(1000);
    });

    it('DEPOSIT increments balance from previous balance', async () => {
      mockEntityManager.findOne.mockResolvedValue({ balanceAfter: 5000 });

      const result = await service.recordMovement(
        MovementType.DEPOSIT, 2000, 'Depósito', 1,
      );

      expect(result.balanceAfter).toBe(7000);
    });

    it('LOAN_OUT decrements balance', async () => {
      mockEntityManager.findOne.mockResolvedValue({ balanceAfter: 10000 });

      const result = await service.recordMovement(
        MovementType.LOAN_OUT, 3000, 'Préstamo otorgado', 1,
      );

      expect(result.balanceAfter).toBe(7000);
    });

    it('EXPENSE decrements balance', async () => {
      mockEntityManager.findOne.mockResolvedValue({ balanceAfter: 10000 });

      const result = await service.recordMovement(
        MovementType.EXPENSE, 500, 'Gasto operativo', 1,
      );

      expect(result.balanceAfter).toBe(9500);
    });

    it('uses transactionalEntityManager when provided', async () => {
      const txManager: any = {
        findOne: jest.fn().mockResolvedValue({ balanceAfter: 1000 }),
        create: jest.fn().mockImplementation((_cls: any, data: any) => ({ ...data })),
        save: jest.fn().mockImplementation(async (entity: any) => ({ id: 1, ...entity })),
      };

      await service.recordMovement(
        MovementType.PAYMENT_IN, 500, 'Pago', 1, 'payment', 1, txManager,
      );

      expect(txManager.findOne).toHaveBeenCalled();
      expect(mockEntityManager.findOne).not.toHaveBeenCalled();
    });

    it('stores referenceType and referenceId', async () => {
      mockEntityManager.findOne.mockResolvedValue(null);

      const result = await service.recordMovement(
        MovementType.PAYMENT_IN, 1000, 'Test', 1, 'payment', 42,
      );

      expect(result.referenceType).toBe('payment');
      expect(result.referenceId).toBe(42);
    });
  });

  describe('revertMovement', () => {
    it('removes the cash movement', async () => {
      const mockMovement = { id: 5, amount: 1000 };
      const txManager: any = {
        findOne: jest.fn().mockResolvedValue(mockMovement),
        remove: jest.fn(),
      };

      await service.revertMovement('payment', 1, txManager);

      expect(txManager.remove).toHaveBeenCalledWith(CashMovement, mockMovement);
    });

    it('throws NotFoundException if movement not found', async () => {
      const txManager: any = {
        findOne: jest.fn().mockResolvedValue(null),
      };

      await expect(
        service.revertMovement('payment', 999, txManager),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCurrentBalance', () => {
    it('returns last movement balanceAfter', async () => {
      mockRepo.findOne.mockResolvedValue({ balanceAfter: 5000 });

      const result = await service.getCurrentBalance();

      expect(result).toBe(5000);
    });

    it('returns 0 if no movements exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.getCurrentBalance();

      expect(result).toBe(0);
    });
  });
});
