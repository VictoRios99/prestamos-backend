import {
  IsNumber,
  IsDateString,
  IsOptional,
  IsString,
  IsNumberString,
  IsIn,
  IsInt,
} from 'class-validator';

export class CreateLoanDto {
  @IsNumber()
  customerId: number;

  @IsDateString()
  loanDate: string;

  @IsNumber()
  amount: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  monthlyInterestRate?: string;

  @IsInt()
  @IsOptional()
  term?: number; // Plazo en quincenas, opcional

  @IsString()
  @IsOptional()
  modality?: string;

  @IsString()
  @IsOptional()
  loanType?: string;

  @IsNumber()
  @IsOptional()
  totalToPay?: number;

  // Removemos termMonths, paymentFrequency ya que el sistema es flexible
  // El cliente paga cuando puede, mínimo el 5% mensual
}
