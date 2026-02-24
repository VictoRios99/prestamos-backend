import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog, ActivityAction } from './entities/activity-log.entity';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { geolocateIp } from '../common/utils/geolocate-ip';
import { reverseGeocode } from '../common/utils/reverse-geocode';

export interface LogParams {
  action: ActivityAction;
  userId: number;
  userName: string;
  entityType?: string;
  entityId?: number;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface FindAllFilters {
  userId?: number;
  action?: ActivityAction;
  search?: string;
  period?: 'today' | '7d' | '30d';
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ActivityService {
  constructor(
    @InjectRepository(ActivityLog)
    private activityRepo: Repository<ActivityLog>,
    private gateway: NotificationsGateway,
  ) {}

  async log(params: LogParams): Promise<void> {
    try {
      let location = '';
      let locationSource: 'gps' | 'ip' | '' = '';

      // 1) Intentar GPS del navegador (reverse geocode)
      const gps = this.gateway.getBrowserLocation(params.userId);
      if (gps) {
        location = await reverseGeocode(gps.lat, gps.lng);
        if (location) locationSource = 'gps';
      }

      // 2) Fallback a IP geolocation
      if (!location && params.ipAddress) {
        location = await geolocateIp(params.ipAddress);
        if (location) locationSource = 'ip';
      }

      const entry = new ActivityLog();
      entry.action = params.action;
      entry.userId = params.userId;
      entry.userName = params.userName;
      entry.entityType = params.entityType ?? null;
      entry.entityId = params.entityId ?? null;
      entry.details = {
        ...(params.details ?? {}),
        ...(location ? { location } : {}),
        ...(locationSource ? { locationSource } : {}),
      };
      entry.ipAddress = params.ipAddress ?? null;
      entry.userAgent = params.userAgent ?? null;
      const saved = await this.activityRepo.save(entry);
      this.gateway.emitActivity(saved);
    } catch (err) {
      console.error('ActivityService.log error:', err);
    }
  }

  async deleteOne(id: number): Promise<void> {
    await this.activityRepo.delete(id);
  }

  async deleteBulk(filters: {
    action?: ActivityAction;
    period?: 'today' | '7d' | '30d';
  }): Promise<number> {
    const qb = this.activityRepo.createQueryBuilder('a').delete().from(ActivityLog);
    if (filters.action) {
      qb.andWhere('action = :action', { action: filters.action });
    }
    if (filters.period) {
      const now = new Date();
      let since: Date;
      if (filters.period === 'today') {
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (filters.period === '7d') {
        since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else {
        since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      qb.andWhere('created_at >= :since', { since });
    }
    const result = await qb.execute();
    return result.affected ?? 0;
  }

  async findAll(filters: FindAllFilters) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 30;
    const skip = (page - 1) * limit;

    const qb = this.activityRepo
      .createQueryBuilder('a')
      .orderBy('a.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (filters.userId) {
      qb.andWhere('a.user_id = :userId', { userId: filters.userId });
    }
    if (filters.action) {
      qb.andWhere('a.action = :action', { action: filters.action });
    }
    if (filters.search) {
      qb.andWhere(
        '(a.user_name ILIKE :search OR a.details::text ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    // Period shortcuts
    if (filters.period) {
      const now = new Date();
      let since: Date;
      if (filters.period === 'today') {
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (filters.period === '7d') {
        since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else {
        since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      qb.andWhere('a.created_at >= :since', { since });
    } else {
      if (filters.startDate) {
        qb.andWhere('a.created_at >= :startDate', {
          startDate: new Date(filters.startDate),
        });
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        qb.andWhere('a.created_at <= :endDate', { endDate: end });
      }
    }

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
