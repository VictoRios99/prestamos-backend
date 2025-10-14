import { ValidatorConstraintInterface, ValidationArguments, ValidationOptions } from 'class-validator';
import { Repository } from 'typeorm';
import { Loan } from '../../loans/entities/loan.entity';
export declare class IsAfterLoanDateConstraint implements ValidatorConstraintInterface {
    private loanRepository;
    constructor(loanRepository: Repository<Loan>);
    validate(paymentDate: string, args: ValidationArguments): Promise<boolean>;
    defaultMessage(args: ValidationArguments): string;
}
export declare function IsAfterLoanDate(relatedPropertyName: string, validationOptions?: ValidationOptions): (object: object, propertyName: string) => void;
