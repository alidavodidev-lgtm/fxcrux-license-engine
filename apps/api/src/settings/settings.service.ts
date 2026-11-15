import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSettings } from './system-settings.entity';

interface ActingAdmin {
  id: string;
  username: string;
}

@Injectable()
export class SettingsService {
  // Single Nest process, no horizontal scaling in this deployment - an
  // in-memory cache on the service instance is safe and avoids a DB hit on
  // every upload. Invalidated on every updateSettings() call.
  private cache: SystemSettings | null = null;

  constructor(
    @InjectRepository(SystemSettings) private settingsRepository: Repository<SystemSettings>,
  ) {}

  async getSettings(): Promise<SystemSettings> {
    if (this.cache) return this.cache;
    let row = await this.settingsRepository.findOne({ where: { id: 1 } });
    if (!row) {
      row = await this.settingsRepository.save(this.settingsRepository.create({ id: 1 }));
    }
    this.cache = row;
    return row;
  }

  async updateSettings(data: { product_image_max_kb?: number; ticket_attachment_max_kb?: number; product_file_max_mb?: number }, actingAdmin: ActingAdmin) {
    const row = await this.getSettings();
    Object.assign(row, data, { updated_by: { id: actingAdmin.id } as any });
    const saved = await this.settingsRepository.save(row);
    this.cache = saved;
    return saved;
  }

  async getUploadLimits() {
    const s = await this.getSettings();
    return {
      productImageMaxBytes: s.product_image_max_kb * 1024,
      ticketAttachmentMaxBytes: s.ticket_attachment_max_kb * 1024,
      productFileMaxBytes: s.product_file_max_mb * 1024 * 1024,
    };
  }
}
