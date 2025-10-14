import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import * as XLSX from 'xlsx';
import { validate } from 'class-validator';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private customersRepository: Repository<Customer>,
  ) {}

  async create(
    createCustomerDto: CreateCustomerDto,
    userId: number,
  ): Promise<Customer> {
    const customer = this.customersRepository.create({
      ...createCustomerDto,
      createdBy: { id: userId },
    });
    return this.customersRepository.save(customer);
  }

  async findAll(): Promise<Customer[]> {
    return this.customersRepository.find({
      relations: ['loans'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Customer> {
    const customer = await this.customersRepository.findOne({
      where: { id },
      relations: ['loans', 'loans.payments'],
    });
    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }
    return customer;
  }

  async update(
    id: number,
    updateCustomerDto: UpdateCustomerDto,
  ): Promise<Customer> {
    await this.customersRepository.update(id, updateCustomerDto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const result = await this.customersRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }
  }

  /**
   * Normaliza un texto: elimina acentos, virgulillas, caracteres especiales
   * y convierte todo a MAYÚSCULAS
   */
  private normalizeText(text: string): string {
    if (!text || typeof text !== 'string') return '';

    // Convertir a string y limpiar espacios
    text = String(text).trim();

    // Eliminar acentos y virgulillas usando normalize
    text = text
      .normalize('NFD') // Descomponer caracteres con acentos
      .replace(/[\u0300-\u036f]/g, '') // Eliminar marcas diacríticas
      .replace(/[ñÑ]/g, 'N'); // Reemplazar ñ con N

    // Eliminar caracteres especiales, manteniendo solo letras, números y espacios
    text = text.replace(/[^a-zA-Z0-9\s]/g, '');

    // Convertir todo a MAYÚSCULAS y limpiar espacios múltiples
    text = text.toUpperCase().replace(/\s+/g, ' ').trim();

    return text;
  }

  /**
   * Obtiene el valor de una columna del Excel con múltiples variaciones de nombre
   */
  private getColumnValue(row: any, ...columnNames: string[]): string {
    for (const name of columnNames) {
      if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
        return String(row[name]).trim();
      }
    }
    return '';
  }

  async bulkUpload(buffer: Buffer): Promise<{
    success: number;
    failed: number;
    errors: Array<{ row: number; name: string; errors: string[] }>;
  }> {
    // Leer el archivo Excel
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convertir a JSON
    const data: any[] = XLSX.utils.sheet_to_json(worksheet);

    if (!data || data.length === 0) {
      throw new BadRequestException('El archivo Excel está vacío');
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ row: number; name: string; errors: string[] }>,
    };

    // Procesar cada fila
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2; // +2 porque Excel empieza en 1 y tiene header

      try {
        // Obtener valores de las columnas con múltiples variaciones
        const firstName = this.getColumnValue(
          row,
          'Nombre',
          'nombre',
          'NOMBRE',
          'First Name',
          'firstname',
        );
        const lastName = this.getColumnValue(
          row,
          'Apellidos',
          'apellidos',
          'APELLIDOS',
          'Apellido',
          'apellido',
          'APELLIDO',
          'Last Name',
          'lastname',
        );
        const phone = this.getColumnValue(
          row,
          'Teléfono',
          'Telefono',
          'telefono',
          'TELEFONO',
          'Phone',
          'phone',
        );
        const email = this.getColumnValue(
          row,
          'Email',
          'email',
          'EMAIL',
          'Correo',
          'correo',
          'CORREO',
        );
        const address = this.getColumnValue(
          row,
          'Dirección',
          'Direccion',
          'direccion',
          'DIRECCION',
          'Address',
          'address',
        );

        // Mapear columnas del Excel a CreateCustomerDto con normalización
        const customerDto = new CreateCustomerDto();
        customerDto.firstName = this.normalizeText(firstName);
        customerDto.lastName = this.normalizeText(lastName);
        customerDto.phone = phone; // El teléfono no se normaliza (mantener números)
        customerDto.email = email.toUpperCase(); // Email en MAYÚSCULAS
        customerDto.address = this.normalizeText(address);

        // Validar el DTO
        const errors = await validate(customerDto);

        if (errors.length > 0) {
          const errorMessages = errors.map(err =>
            Object.values(err.constraints || {}).join(', ')
          );
          results.errors.push({
            row: rowNumber,
            name: `${customerDto.firstName} ${customerDto.lastName}`,
            errors: errorMessages,
          });
          results.failed++;
          continue;
        }

        // Crear el cliente
        await this.create(customerDto, 1); // userId fijo
        results.success++;
      } catch (error) {
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
}
