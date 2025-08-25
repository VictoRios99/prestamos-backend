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

  @IsString()
  @IsNumberString()
  amount: string;

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

  @IsString()
  @IsOptional()
  totalToPay?: string;

  // Removemos termMonths, paymentFrequency ya que el sistema es flexible
  // El cliente paga cuando puede, mínimo el 5% mensual
}
