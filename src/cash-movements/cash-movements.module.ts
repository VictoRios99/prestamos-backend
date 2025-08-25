import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashMovement } from './entities/cash-movement.entity';
import { CashMovementsService } from './cash-movements.service';

@Module({
  imports: [TypeOrmModule.forFeature([CashMovement])],
  providers: [CashMovementsService],
  exports: [CashMovementsService],
})
export class CashMovementsModule {}
