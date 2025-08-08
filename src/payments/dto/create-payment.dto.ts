import { IsNumber, IsDateString, IsOptional, IsString } from 'class-validator';
import { IsAfterLoanDate } from '../../common/validators/is-after-loan-date.validator';

export class CreatePaymentDto {
  @IsNumber()
  loanId: number;

  @IsDateString()
  @IsAfterLoanDate('loanId', { message: 'La fecha de pago no puede ser anterior a la fecha de inicio del préstamo.' })
  paymentDate: string;

  @IsNumber()
  amount: number;

  @IsString()
  @IsOptional()
  paymentMethod?: string = 'CASH';

  @IsString()
  @IsOptional()
  notes?: string;
}
