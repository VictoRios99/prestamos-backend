import {
  IsNumber,
  IsDateString,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePaymentDto {
  @IsNumber()
  loanId: number;

  @IsDateString()
  paymentDate: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  capitalAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  interestAmount?: number;

  @IsString()
  @IsOptional()
  paymentMethod?: string = 'CASH';

  @IsString()
  @IsOptional()
  notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  overduePeriodsPaid?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lateInterest?: number;
}
