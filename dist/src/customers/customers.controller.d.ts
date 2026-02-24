import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { ActivityService } from '../activity/activity.service';
import { Request } from 'express';
export declare class CustomersController {
    private readonly customersService;
    private readonly activityService;
    constructor(customersService: CustomersService, activityService: ActivityService);
    create(createCustomerDto: CreateCustomerDto, req: Request): Promise<import("./entities/customer.entity").Customer>;
    findAll(): Promise<import("./entities/customer.entity").Customer[]>;
    findOne(id: string): Promise<import("./entities/customer.entity").Customer>;
    update(id: string, updateCustomerDto: UpdateCustomerDto, req: Request): Promise<import("./entities/customer.entity").Customer>;
    remove(id: string, req: Request): Promise<void>;
    bulkUpload(file: any): Promise<{
        success: number;
        failed: number;
        errors: Array<{
            row: number;
            name: string;
            errors: string[];
        }>;
    }>;
}
