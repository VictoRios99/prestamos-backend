"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CashMovementsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const cash_movement_entity_1 = require("./entities/cash-movement.entity");
let CashMovementsService = class CashMovementsService {
    cashMovementRepository;
    entityManager;
    constructor(cashMovementRepository, entityManager) {
        this.cashMovementRepository = cashMovementRepository;
        this.entityManager = entityManager;
    }
    async recordMovement(type, amount, description, userId, referenceType, referenceId, transactionalEntityManager) {
        const manager = transactionalEntityManager || this.entityManager;
        const lastMovement = await manager.findOne(cash_movement_entity_1.CashMovement, {
            where: {},
            order: { id: 'DESC' },
            lock: { mode: 'pessimistic_write' },
        });
        let balanceAfter = lastMovement ? Number(lastMovement.balanceAfter) : 0;
        if (type === cash_movement_entity_1.MovementType.DEPOSIT || type === cash_movement_entity_1.MovementType.PAYMENT_IN) {
            balanceAfter += amount;
        }
        else {
            balanceAfter -= amount;
        }
        const movement = manager.create(cash_movement_entity_1.CashMovement, {
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
    async revertMovement(referenceType, referenceId, transactionalEntityManager) {
        const movement = await transactionalEntityManager.findOne(cash_movement_entity_1.CashMovement, {
            where: { referenceType, referenceId },
        });
        if (!movement) {
            throw new common_1.NotFoundException(`No se encontró movimiento de caja para revertir: ${referenceType} #${referenceId}`);
        }
        await transactionalEntityManager.remove(cash_movement_entity_1.CashMovement, movement);
    }
    async getCurrentBalance() {
        const lastMovement = await this.cashMovementRepository.findOne({
            where: {},
            order: { id: 'DESC' },
        });
        return lastMovement ? Number(lastMovement.balanceAfter) : 0;
    }
    async getMovementsByDateRange(startDate, endDate) {
        return this.cashMovementRepository.find({
            where: {
                movementDate: (0, typeorm_2.Between)(startDate, endDate),
            },
            relations: ['createdBy'],
            order: { movementDate: 'DESC' },
        });
    }
};
exports.CashMovementsService = CashMovementsService;
exports.CashMovementsService = CashMovementsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(cash_movement_entity_1.CashMovement)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.EntityManager])
], CashMovementsService);
//# sourceMappingURL=cash-movements.service.js.map