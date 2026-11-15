import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditAction } from './audit-log.entity';

interface RecordEntry {
  actorType: 'ADMIN' | 'USER' | 'SYSTEM';
  actorId?: string | null;
  actorLabel?: string | null;
  action: AuditAction;
  targetType?: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  metadata?: Record<string, any> | null;
  ipAddress?: string | null;
}

interface FindLogsFilters {
  actorType?: string;
  action?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: string;
}

// Whitelisted so a sortBy value never gets built into raw SQL from user input.
const SORT_COLUMNS: Record<string, string> = {
  created_at: 'log.created_at',
  actor_type: 'log.actor_type',
  actor_label: 'log.actor_label',
  action: 'log.action',
  target_label: 'log.target_label',
};

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog) private auditLogRepository: Repository<AuditLog>,
  ) {}

  // Fire-and-forget from the caller's perspective - a logging failure must
  // never break the actual operation it's recording.
  async record(entry: RecordEntry) {
    try {
      const log = this.auditLogRepository.create({
        actor_type: entry.actorType,
        actor_id: entry.actorId ?? null,
        actor_label: entry.actorLabel ?? null,
        action: entry.action,
        target_type: entry.targetType ?? null,
        target_id: entry.targetId ?? null,
        target_label: entry.targetLabel ?? null,
        metadata: entry.metadata ?? null,
        ip_address: entry.ipAddress ?? null,
      });
      await this.auditLogRepository.save(log);
    } catch (err: any) {
      console.error('AuditLog write failed:', err.message);
    }
  }

  async findLogs(filters: FindLogsFilters) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 50));

    const qb = this.auditLogRepository.createQueryBuilder('log');
    if (filters.actorType && filters.actorType !== 'ALL') {
      qb.andWhere('log.actor_type = :actorType', { actorType: filters.actorType });
    }
    if (filters.action && filters.action !== 'ALL') {
      qb.andWhere('log.action = :action', { action: filters.action });
    }
    if (filters.from) {
      qb.andWhere('log.created_at >= :from', { from: new Date(filters.from) });
    }
    if (filters.to) {
      qb.andWhere('log.created_at <= :to', { to: new Date(filters.to) });
    }
    if (filters.search) {
      qb.andWhere('(log.actor_label ILIKE :s OR log.target_label ILIKE :s OR log.action ILIKE :s)', { s: `%${filters.search}%` });
    }

    const sortColumn = SORT_COLUMNS[filters.sortBy || ''] || 'log.created_at';
    const sortDir = filters.sortDir === 'ASC' ? 'ASC' : 'DESC';

    const [rows, total] = await qb
      .orderBy(sortColumn, sortDir)
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { rows, total, page, limit };
  }
}
