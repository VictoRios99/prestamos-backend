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
exports.IsAfterLoanDateConstraint = void 0;
exports.IsAfterLoanDate = IsAfterLoanDate;
const class_validator_1 = require("class-validator");
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const loan_entity_1 = require("../../loans/entities/loan.entity");
let IsAfterLoanDateConstraint = class IsAfterLoanDateConstraint {
    loanRepository;
    constructor(loanRepository) {
        this.loanRepository = loanRepository;
    }
    async validate(paymentDate, args) {
        const [relatedPropertyName] = args.constraints;
        const loanId = args.object[relatedPropertyName];
        if (!loanId) {
            return false;
        }
        const loan = await this.loanRepository.findOne({ where: { id: loanId } });
        if (!loan) {
            return false;
        }
        const loanDate = new Date(loan.loanDate);
        const paymentDateObj = new Date(paymentDate);
        return paymentDateObj.getTime() >= loanDate.getTime();
    }
    defaultMessage(args) {
        const [relatedPropertyName] = args.constraints;
        const loanId = args.object[relatedPropertyName];
        return `La fecha de pago (${args.value}) no puede ser anterior a la fecha de inicio del préstamo #${loanId}.`;
    }
};
exports.IsAfterLoanDateConstraint = IsAfterLoanDateConstraint;
exports.IsAfterLoanDateConstraint = IsAfterLoanDateConstraint = __decorate([
    (0, class_validator_1.ValidatorConstraint)({ async: true }),
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(loan_entity_1.Loan)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], IsAfterLoanDateConstraint);
function IsAfterLoanDate(relatedPropertyName, validationOptions) {
    return (object, propertyName) => {
        (0, class_validator_1.registerDecorator)({
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            constraints: [relatedPropertyName],
            validator: IsAfterLoanDateConstraint,
        });
    };
}
//# sourceMappingURL=is-after-loan-date.validator.js.map