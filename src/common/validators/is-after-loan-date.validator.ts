import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Loan } from '../../loans/entities/loan.entity';

@ValidatorConstraint({ async: true })
@Injectable()
export class IsAfterLoanDateConstraint implements ValidatorConstraintInterface {
  constructor(
    @InjectRepository(Loan)
    private loanRepository: Repository<Loan>,
  ) {}

  async validate(paymentDate: string, args: ValidationArguments) {
    const [relatedPropertyName] = args.constraints;
    const loanId = (args.object as any)[relatedPropertyName];

    if (!loanId) {
      return false; // loanId is required for this validation
    }

    const loan = await this.loanRepository.findOne({ where: { id: loanId } });

    if (!loan) {
      return false; // Loan not found, cannot validate date
    }

    const loanDate = new Date(loan.loanDate);
    const paymentDateObj = new Date(paymentDate);

    // Allow paymentDate to be equal to or after loanDate
    return paymentDateObj.getTime() >= loanDate.getTime();
  }

  defaultMessage(args: ValidationArguments) {
    const [relatedPropertyName] = args.constraints;
    const loanId = (args.object as any)[relatedPropertyName];
    return `La fecha de pago (${args.value}) no puede ser anterior a la fecha de inicio del préstamo #${loanId}.`;
  }
}

export function IsAfterLoanDate(
  relatedPropertyName: string,
  validationOptions?: ValidationOptions,
) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [relatedPropertyName],
      validator: IsAfterLoanDateConstraint,
    });
  };
}
