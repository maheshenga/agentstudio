import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { CreateDeveloperAppDto, UpdateDeveloperAppDto } from '../dto/app-developer.dto';
import { AppPackageEntity } from '../entities/app-package.entity';
import { AppPlatformService } from './app-platform.service';

@Injectable()
export class AppDeveloperService {
  constructor(
    @InjectRepository(AppPackageEntity)
    private readonly appRepo: Repository<AppPackageEntity>,
    private readonly appPlatformService: AppPlatformService,
  ) {}

  listApps(developerId: number) {
    return this.appPlatformService.listDeveloperApps(developerId);
  }

  async getApp(code: string, developerId: number) {
    await this.findOwnedApp(code, developerId);
    return this.appPlatformService.getApp(code);
  }

  async createApp(dto: CreateDeveloperAppDto, developerId: number, developerName: string) {
    const metadata = this.sanitizeMetadata(dto);
    return this.appPlatformService.createApp(
      {
        code: dto.code.trim(),
        ...metadata,
        name: this.sanitizeRequiredName(dto.name),
        type: 'static',
        visibility: 'marketplace',
        developer_name: String(developerName || `User ${developerId}`).slice(0, 100),
      },
      developerId,
    );
  }

  async updateApp(code: string, dto: UpdateDeveloperAppDto, developerId: number) {
    const app = await this.findOwnedApp(code, developerId);
    if (app.status !== 'draft' && app.status !== 'rejected') {
      throw new BadRequestException('Only draft or rejected apps can be edited');
    }
    return this.appPlatformService.updateApp(code, this.sanitizeMetadata(dto));
  }

  async uploadVersion(code: string, file: Express.Multer.File, developerId: number) {
    const app = await this.findOwnedApp(code, developerId);
    if (app.status === 'disabled' || app.status === 'archived') {
      throw new BadRequestException('Disabled or archived apps cannot upload versions');
    }
    return this.appPlatformService.uploadStaticVersion(code, file, developerId);
  }

  async submitVersion(code: string, version: string, developerId: number) {
    await this.findOwnedApp(code, developerId);
    return this.appPlatformService.submitVersion(code, version, developerId);
  }

  private async findOwnedApp(code: string, developerId: number) {
    const app = await this.appRepo.findOne({
      where: { code, developerId, deleteTime: IsNull() },
    });
    if (!app) {
      throw new NotFoundException(`App ${code} not found`);
    }
    return app;
  }

  private sanitizeMetadata(dto: UpdateDeveloperAppDto) {
    const metadata: UpdateDeveloperAppDto = {};
    if (dto.name !== undefined) {
      metadata.name = this.sanitizeRequiredName(dto.name);
    }
    for (const key of ['category', 'icon', 'summary', 'description'] as const) {
      if (dto[key] !== undefined) {
        metadata[key] = dto[key]?.trim();
      }
    }
    return metadata;
  }

  private sanitizeRequiredName(value: string) {
    const name = String(value || '').trim();
    if (!name) {
      throw new BadRequestException('App name is required');
    }
    return name;
  }
}
