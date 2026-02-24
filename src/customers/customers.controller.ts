import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { ActivityService } from '../activity/activity.service';
import { ActivityAction } from '../activity/entities/activity-log.entity';
import { Request } from 'express';
import { getClientIp } from '../common/utils/get-client-ip';

@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly activityService: ActivityService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OPERATOR)
  async create(@Body() createCustomerDto: CreateCustomerDto, @Req() req: Request) {
    const user = req.user as any;
    const customer = await this.customersService.create(createCustomerDto, user.userId);
    this.activityService.log({
      action: ActivityAction.CREATE_CUSTOMER,
      userId: user.userId,
      userName: user.fullName || user.username,
      entityType: 'customer',
      entityId: customer.id,
      details: { name: `${createCustomerDto.firstName} ${createCustomerDto.lastName}` },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });
    return customer;
  }

  @Get()
  findAll() {
    return this.customersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(+id);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OPERATOR)
  async update(
    @Param('id') id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    const result = await this.customersService.update(+id, updateCustomerDto);
    this.activityService.log({
      action: ActivityAction.UPDATE_CUSTOMER,
      userId: user.userId,
      userName: user.fullName || user.username,
      entityType: 'customer',
      entityId: +id,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });
    return result;
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async remove(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    const result = await this.customersService.remove(+id);
    this.activityService.log({
      action: ActivityAction.DELETE_CUSTOMER,
      userId: user.userId,
      userName: user.fullName || user.username,
      entityType: 'customer',
      entityId: +id,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });
    return result;
  }

  @Post('bulk-upload')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OPERATOR)
  @UseInterceptors(FileInterceptor('file'))
  async bulkUpload(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No se ha proporcionado ningun archivo');
    }

    if (!file.originalname.match(/\.(xlsx|xls)$/)) {
      throw new BadRequestException(
        'Formato de archivo invalido. Solo se permiten archivos Excel (.xlsx, .xls)',
      );
    }

    return this.customersService.bulkUpload(file.buffer);
  }
}
