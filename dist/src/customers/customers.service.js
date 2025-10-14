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
exports.CustomersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const customer_entity_1 = require("./entities/customer.entity");
const create_customer_dto_1 = require("./dto/create-customer.dto");
const XLSX = require("xlsx");
const class_validator_1 = require("class-validator");
let CustomersService = class CustomersService {
    customersRepository;
    constructor(customersRepository) {
        this.customersRepository = customersRepository;
    }
    async create(createCustomerDto, userId) {
        const customer = this.customersRepository.create({
            ...createCustomerDto,
            createdBy: { id: userId },
        });
        return this.customersRepository.save(customer);
    }
    async findAll() {
        return this.customersRepository.find({
            relations: ['loans'],
            order: { createdAt: 'DESC' },
        });
    }
    async findOne(id) {
        const customer = await this.customersRepository.findOne({
            where: { id },
            relations: ['loans', 'loans.payments'],
        });
        if (!customer) {
            throw new common_1.NotFoundException(`Customer with ID ${id} not found`);
        }
        return customer;
    }
    async update(id, updateCustomerDto) {
        await this.customersRepository.update(id, updateCustomerDto);
        return this.findOne(id);
    }
    async remove(id) {
        const result = await this.customersRepository.delete(id);
        if (result.affected === 0) {
            throw new common_1.NotFoundException(`Customer with ID ${id} not found`);
        }
    }
    normalizeText(text) {
        if (!text || typeof text !== 'string')
            return '';
        text = String(text).trim();
        text = text
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[ñÑ]/g, 'N');
        text = text.replace(/[^a-zA-Z0-9\s]/g, '');
        text = text.toUpperCase().replace(/\s+/g, ' ').trim();
        return text;
    }
    getColumnValue(row, ...columnNames) {
        for (const name of columnNames) {
            if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
                return String(row[name]).trim();
            }
        }
        return '';
    }
    async bulkUpload(buffer) {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);
        if (!data || data.length === 0) {
            throw new common_1.BadRequestException('El archivo Excel está vacío');
        }
        const results = {
            success: 0,
            failed: 0,
            errors: [],
        };
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rowNumber = i + 2;
            try {
                const firstName = this.getColumnValue(row, 'Nombre', 'nombre', 'NOMBRE', 'First Name', 'firstname');
                const lastName = this.getColumnValue(row, 'Apellidos', 'apellidos', 'APELLIDOS', 'Apellido', 'apellido', 'APELLIDO', 'Last Name', 'lastname');
                const phone = this.getColumnValue(row, 'Teléfono', 'Telefono', 'telefono', 'TELEFONO', 'Phone', 'phone');
                const email = this.getColumnValue(row, 'Email', 'email', 'EMAIL', 'Correo', 'correo', 'CORREO');
                const address = this.getColumnValue(row, 'Dirección', 'Direccion', 'direccion', 'DIRECCION', 'Address', 'address');
                const customerDto = new create_customer_dto_1.CreateCustomerDto();
                customerDto.firstName = this.normalizeText(firstName);
                customerDto.lastName = this.normalizeText(lastName);
                customerDto.phone = phone;
                customerDto.email = email.toUpperCase();
                customerDto.address = this.normalizeText(address);
                const errors = await (0, class_validator_1.validate)(customerDto);
                if (errors.length > 0) {
                    const errorMessages = errors.map(err => Object.values(err.constraints || {}).join(', '));
                    results.errors.push({
                        row: rowNumber,
                        name: `${customerDto.firstName} ${customerDto.lastName}`,
                        errors: errorMessages,
                    });
                    results.failed++;
                    continue;
                }
                await this.create(customerDto, 1);
                results.success++;
            }
            catch (error) {
                results.errors.push({
                    row: rowNumber,
                    name: row['Nombre'] || 'Desconocido',
                    errors: [error.message || 'Error desconocido'],
                });
                results.failed++;
            }
        }
        return results;
    }
};
exports.CustomersService = CustomersService;
exports.CustomersService = CustomersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(customer_entity_1.Customer)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], CustomersService);
//# sourceMappingURL=customers.service.js.map