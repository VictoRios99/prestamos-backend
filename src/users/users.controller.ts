import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
  UploadedFile,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from './entities/user.entity';
import { multerPhotoConfig } from './multer-photo.config';
import { ActivityService } from '../activity/activity.service';
import { ActivityAction } from '../activity/entities/activity-log.entity';
import { Request } from 'express';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(ClassSerializerInterceptor)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly activityService: ActivityService,
  ) {}

  // ── Rutas /me primero (antes de /:id) ──

  @Get('me')
  async getMyProfile(@Req() req: Request) {
    const userId = (req.user as any).userId;
    return this.usersService.findById(userId);
  }

  @Patch('me/profile-photo')
  @UseInterceptors(FileInterceptor('photo', multerPhotoConfig))
  async uploadProfilePhoto(@Req() req: Request, @UploadedFile() file: any) {
    const user = req.user as any;
    const userId = user.userId;

    // Eliminar foto anterior si existe
    const currentUser = await this.usersService.findById(userId);
    if (currentUser?.profilePhoto) {
      const oldPath = join(process.cwd(), currentUser.profilePhoto);
      if (existsSync(oldPath)) {
        unlinkSync(oldPath);
      }
    }

    const photoPath = `uploads/profiles/${file.filename}`;
    const result = await this.usersService.updateProfilePhoto(userId, photoPath);

    this.activityService.log({
      action: ActivityAction.UPLOAD_PHOTO,
      userId,
      userName: user.fullName || user.username,
      entityType: 'user',
      entityId: userId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return result;
  }

  // ── Rutas admin-only ──

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  async findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN)
  async findOne(@Param('id') id: string) {
    return this.usersService.findById(+id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN)
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(+id, updateUserDto);
  }
}
