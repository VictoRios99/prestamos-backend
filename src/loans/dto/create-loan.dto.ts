import { IsNumber, IsDateString, IsOptional, IsString, IsNumberString } from 'class-validator';

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

  // Removemos termMonths, paymentFrequency ya que el sistema es flexible
  // El cliente paga cuando puede, mínimo el 5% mensual
}
