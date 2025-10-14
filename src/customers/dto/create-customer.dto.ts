// src/customers/dto/create-customer.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCustomerDto {
  @ApiProperty({ example: 'Juan', description: 'Nombre del cliente' })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) =>
    value ? value.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase() : value,
  )
  firstName: string;

  @ApiProperty({ example: 'Pérez', description: 'Apellido del cliente' })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) =>
    value ? value.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase() : value,
  )
  lastName: string;

  @ApiProperty({
    example: '555-1234',
    description: 'Teléfono',
    required: false,
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({
    example: 'juan@email.com',
    description: 'Email',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({
    example: 'Calle 123',
    description: 'Dirección',
    required: false,
  })
  @IsString()
  @IsOptional()
  address?: string;
}
