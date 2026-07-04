import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';

import { encryptAiSecret, maskAiSecret, decryptAiSecret } from '../../../common/utils/ai-crypto.util';
import { formatDateTime } from '../../../common/utils/index';
import { SaveAiModelDto } from '../dto/save-ai-model.dto';
import { SaveAiProviderDto } from '../dto/save-ai-provider.dto';
import { TestAiProviderDto } from '../dto/test-ai-provider.dto';
import { AiProviderEntity } from '../entities/ai-provider.entity';
import { AiModelEntity } from '../entities/ai-model.entity';
import type { UserType } from '../../system/user/dto/user';
import {
  AI_ADAPTER_OPENAI_COMPATIBLE,
  AI_STATUS_ENABLED,
  isSupportedAiAdapter,
} from '../ai.constants';
import { LlmProviderService } from './llm-provider.service';

@Injectable()
export class AiAdminService {
  constructor(
    @InjectRepository(AiProviderEntity)
    private readonly providerRepo: Repository<AiProviderEntity>,
    @InjectRepository(AiModelEntity)
    private readonly modelRepo: Repository<AiModelEntity>,
    private readonly llmProviderService: LlmProviderService,
  ) {}

  private tenantId(user: UserType) {
    return user.tenantId ?? 0;
  }

  // ── Provider ──────────────────────────────────────────

  /**
   * 分页查询供应商列表，支持按名称模糊搜索
   *
   * @param user - 当前用户信息
   * @param query - 查询参数，包含 page（页码）、limit（每页条数）、name（名称关键字）
   * @returns 包含供应商列表和总数量的对象
   */
  async listProviders(user: UserType, query: { page?: number; limit?: number; name?: string }) {
    const tenantId = this.tenantId(user);
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);

    const qb = this.providerRepo.createQueryBuilder('p');
    qb.where('p.deleteTime IS NULL');
    qb.andWhere('(p.tenantId = :tenantId OR p.tenantId = 0)', { tenantId });
    if (query.name) {
      qb.andWhere('p.name LIKE :name', { name: `%${query.name}%` });
    }
    qb.orderBy('p.sort', 'ASC').addOrderBy('p.id', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [list, total] = await qb.getManyAndCount();
    return {
      list: list.map((item) => this.formatProvider(item)),
      total,
    };
  }

  /**
   * 创建新的 AI 供应商，加密存储 API Key
   *
   * @param user - 当前用户信息
   * @param body - 供应商创建参数，包含 code、name、base_url、api_key 等
   * @returns 格式化后的供应商信息
   */
  async createProvider(user: UserType, body: SaveAiProviderDto) {
    const tenantId = this.tenantId(user);
    if (!body.code || !body.name || !body.base_url) {
      throw new BadRequestException('code、name、base_url 不能为空');
    }
    if (!body.api_key) {
      throw new BadRequestException('api_key 不能为空');
    }

    this.assertAdapterSupported(body.adapter_type);
    await this.assertProviderCodeUnique(tenantId, body.code);

    const entity = this.providerRepo.create({
      tenantId,
      code: body.code,
      name: body.name,
      baseUrl: this.normalizeBaseUrl(body.base_url),
      apiKeyCipher: encryptAiSecret(body.api_key),
      adapterType: body.adapter_type || AI_ADAPTER_OPENAI_COMPATIBLE,
      extraHeaders: body.extra_headers || null,
      status: `${body.status ?? AI_STATUS_ENABLED}`,
      sort: Number(body.sort ?? 0),
      remark: body.remark || '',
      createdBy: user.userId,
      updatedBy: user.userId,
    });
    await this.providerRepo.save(entity);
    return this.formatProvider(entity);
  }

  /**
   * 更新指定供应商的配置信息
   *
   * @param user - 当前用户信息
   * @param id - 供应商 ID
   * @param body - 需要更新的字段，包含 name、base_url、api_key 等可选属性
   * @returns 格式化后的更新后的供应商信息
   */
  async updateProvider(user: UserType, id: string, body: Partial<SaveAiProviderDto>) {
    const entity = await this.getWritableProvider(user, id);
    if (body.code !== undefined && body.code !== entity.code) {
      await this.assertProviderCodeUnique(entity.tenantId, body.code, id);
      entity.code = body.code;
    }
    if (body.name !== undefined) entity.name = body.name;
    if (body.base_url !== undefined) entity.baseUrl = this.normalizeBaseUrl(body.base_url);
    if (body.adapter_type !== undefined) {
      this.assertAdapterSupported(body.adapter_type);
      entity.adapterType = body.adapter_type;
    }
    if (body.extra_headers !== undefined) entity.extraHeaders = body.extra_headers;
    if (body.status !== undefined) entity.status = `${body.status}`;
    if (body.sort !== undefined) entity.sort = Number(body.sort);
    if (body.remark !== undefined) entity.remark = body.remark;
    if (body.api_key) {
      entity.apiKeyCipher = encryptAiSecret(body.api_key);
    }
    entity.updatedBy = user.userId;
    await this.providerRepo.save(entity);
    return this.formatProvider(entity);
  }

  /**
   * 删除指定供应商，删除前校验其下是否有未删除的模型
   *
   * @param user - 当前用户信息
   * @param id - 供应商 ID
   * @returns 包含被删除供应商 ID 的对象
   * @throws BadRequestException 当供应商下存在未删除的模型时
   */
  async deleteProvider(user: UserType, id: string) {
    await this.getWritableProvider(user, id);
    const modelCount = await this.modelRepo.count({
      where: { providerId: id, deleteTime: IsNull() },
    });
    if (modelCount > 0) {
      throw new BadRequestException('请先删除该供应商下的模型');
    }
    await this.providerRepo.softDelete({ id });
    return { id };
  }

  // ── Model ─────────────────────────────────────────────

  /**
   * 分页查询模型列表，关联供应商名称
   *
   * @param user - 当前用户信息
   * @param query - 查询参数，包含 page（页码）、limit（每页条数）、name（名称关键字）
   * @returns 包含模型列表（含供应商名称）和总数量的对象
   */
  async listModels(user: UserType, query: { page?: number; limit?: number; name?: string }) {
    const tenantId = this.tenantId(user);
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);

    const qb = this.modelRepo.createQueryBuilder('m');
    qb.where('m.deleteTime IS NULL');
    qb.andWhere('(m.tenantId = :tenantId OR m.tenantId = 0)', { tenantId });
    if (query.name) {
      qb.andWhere('m.name LIKE :name', { name: `%${query.name}%` });
    }
    qb.orderBy('m.sort', 'ASC').addOrderBy('m.id', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [list, total] = await qb.getManyAndCount();
    const providerIds = [...new Set(list.map((m) => m.providerId))];
    const providers = providerIds.length
      ? await this.providerRepo.find({ where: { id: In(providerIds) } })
      : [];
    const providerMap = new Map(providers.map((p) => [p.id, p.name]));

    return {
      list: list.map((item) => ({
        ...this.formatModel(item),
        provider_name: providerMap.get(item.providerId) ?? '',
      })),
      total,
    };
  }

  /**
   * 创建新的 AI 模型，若标记为默认则先清除其他默认模型
   *
   * @param user - 当前用户信息
   * @param body - 模型创建参数，包含 provider_id、model_code、name 等
   * @returns 格式化后的模型信息
   */
  async createModel(user: UserType, body: SaveAiModelDto) {
    const tenantId = this.tenantId(user);
    if (!body.provider_id || !body.model_code || !body.name) {
      throw new BadRequestException('provider_id、model_code、name 不能为空');
    }
    const provider = await this.getWritableProvider(user, body.provider_id);
    if (provider.status !== AI_STATUS_ENABLED) throw new BadRequestException('Provider is disabled');
    await this.assertModelCodeUnique(tenantId, body.provider_id, body.model_code);

    if (Number(body.is_default) === 1) {
      await this.modelRepo.update({ tenantId }, { isDefault: 0 });
    }

    const entity = await this.modelRepo.save(
      this.modelRepo.create({
        tenantId,
        providerId: body.provider_id,
        modelCode: body.model_code,
        name: body.name,
        contextWindow: Number(body.context_window ?? 32000),
        maxOutputTokens: Number(body.max_output_tokens ?? 4096),
        defaultTemperature: Number(body.default_temperature ?? 0.7),
        isDefault: Number(body.is_default ?? 0),
        status: `${body.status ?? AI_STATUS_ENABLED}`,
        sort: Number(body.sort ?? 0),
        remark: body.remark || '',
        createdBy: user.userId,
        updatedBy: user.userId,
      }),
    );
    return this.formatModel(entity);
  }

  /**
   * 更新指定模型的配置信息
   *
   * @param user - 当前用户信息
   * @param id - 模型 ID
   * @param body - 需要更新的字段，包含 provider_id、model_code、name、context_window 等可选属性
   * @returns 格式化后的更新后的模型信息
   */
  async updateModel(user: UserType, id: string, body: Partial<SaveAiModelDto>) {
    const entity = await this.getWritableModel(user, id);
    if (body.provider_id !== undefined) {
      const provider = await this.getWritableProvider(user, body.provider_id);
      if (provider.status !== AI_STATUS_ENABLED) throw new BadRequestException('Provider is disabled');
      await this.assertModelCodeUnique(
        entity.tenantId,
        body.provider_id,
        body.model_code ?? entity.modelCode,
        id,
      );
      entity.providerId = body.provider_id;
    }
    if (body.model_code !== undefined && body.model_code !== entity.modelCode) {
      await this.assertModelCodeUnique(entity.tenantId, entity.providerId, body.model_code, id);
      entity.modelCode = body.model_code;
    }
    if (body.name !== undefined) entity.name = body.name;
    if (body.context_window !== undefined) entity.contextWindow = Number(body.context_window);
    if (body.max_output_tokens !== undefined) entity.maxOutputTokens = Number(body.max_output_tokens);
    if (body.default_temperature !== undefined) {
      entity.defaultTemperature = Number(body.default_temperature);
    }
    if (body.is_default !== undefined) {
      if (Number(body.is_default) === 1) {
        await this.modelRepo.update({ tenantId: entity.tenantId }, { isDefault: 0 });
      }
      entity.isDefault = Number(body.is_default);
    }
    if (body.status !== undefined) entity.status = `${body.status}`;
    if (body.sort !== undefined) entity.sort = Number(body.sort);
    if (body.remark !== undefined) entity.remark = body.remark;
    entity.updatedBy = user.userId;
    await this.modelRepo.save(entity);
    return this.formatModel(entity);
  }

  async deleteModel(user: UserType, id: string) {
    await this.getWritableModel(user, id);
    await this.modelRepo.softDelete({ id });
    return { id };
  }

  async providerOptions(user: UserType) {
    const tenantId = this.tenantId(user);
    const list = await this.providerRepo.find({
      where: [
        { tenantId, status: AI_STATUS_ENABLED, deleteTime: IsNull() },
        { tenantId: 0, status: AI_STATUS_ENABLED, deleteTime: IsNull() },
      ],
      order: { sort: 'ASC', id: 'ASC' },
    });
    return list.map((p) => ({ id: p.id, name: p.name, code: p.code }));
  }

  async testProvider(user: UserType, id: string, body: TestAiProviderDto = {}) {
    const provider = await this.getWritableProvider(user, id);
    const modelCode = body.model_code || (await this.findFirstEnabledModelCode(user, id));
    if (!provider.apiKeyCipher) {
      return {
        provider_id: id,
        model_code: modelCode,
        ok: false,
        latency_ms: 0,
        message: 'Provider API key is not configured',
      };
    }
    if (!modelCode) {
      return {
        provider_id: id,
        model_code: '',
        ok: false,
        latency_ms: 0,
        message: 'No enabled model configured for this provider',
      };
    }

    const startedAt = Date.now();
    try {
      const result = await this.llmProviderService.completeChat(
        provider,
        decryptAiSecret(provider.apiKeyCipher),
        {
          model: modelCode,
          messages: [{ role: 'user', content: 'ping' }],
          maxTokens: 16,
          temperature: 0,
        },
      );
      return {
        provider_id: id,
        model_code: modelCode,
        ok: true,
        latency_ms: Date.now() - startedAt,
        message: result.content.slice(0, 100) || 'ok',
      };
    } catch (err: any) {
      return {
        provider_id: id,
        model_code: modelCode,
        ok: false,
        latency_ms: Date.now() - startedAt,
        message: (err?.message || 'Provider test failed').slice(0, 200),
      };
    }
  }

  private formatProvider(item: AiProviderEntity) {
    let masked = '';
    if (item.apiKeyCipher) {
      try {
        masked = maskAiSecret(decryptAiSecret(item.apiKeyCipher));
      } catch {
        masked = '****';
      }
    }
    return {
      id: item.id,
      tenant_id: item.tenantId,
      code: item.code,
      name: item.name,
      base_url: item.baseUrl,
      adapter_type: item.adapterType,
      api_key_masked: masked,
      status: item.status,
      sort: item.sort,
      remark: item.remark,
      create_time: formatDateTime(item.createTime),
      update_time: formatDateTime(item.updateTime),
    };
  }

  private formatModel(item: AiModelEntity) {
    return {
      id: item.id,
      tenant_id: item.tenantId,
      provider_id: item.providerId,
      model_code: item.modelCode,
      name: item.name,
      context_window: item.contextWindow,
      max_output_tokens: item.maxOutputTokens,
      default_temperature: Number(item.defaultTemperature),
      is_default: item.isDefault,
      status: item.status,
      sort: item.sort,
      remark: item.remark,
      create_time: formatDateTime(item.createTime),
      update_time: formatDateTime(item.updateTime),
    };
  }

  private async getOwnedProvider(user: UserType, id: string) {
    const tenantId = this.tenantId(user);
    const entity = await this.providerRepo.findOne({ where: { id, deleteTime: IsNull() } });
    if (!entity) throw new NotFoundException('供应商不存在');
    if (entity.tenantId !== 0 && entity.tenantId !== tenantId) {
      throw new NotFoundException('无权操作该供应商');
    }
    return entity;
  }

  private async getWritableProvider(user: UserType, id: string) {
    const tenantId = this.tenantId(user);
    const entity = await this.getOwnedProvider(user, id);
    if (entity.tenantId !== tenantId) {
      throw new NotFoundException('无权操作该供应商');
    }
    return entity;
  }

  private async getOwnedModel(user: UserType, id: string) {
    const tenantId = this.tenantId(user);
    const entity = await this.modelRepo.findOne({ where: { id, deleteTime: IsNull() } });
    if (!entity) throw new NotFoundException('模型不存在');
    if (entity.tenantId !== 0 && entity.tenantId !== tenantId) {
      throw new NotFoundException('无权操作该模型');
    }
    return entity;
  }

  private async getWritableModel(user: UserType, id: string) {
    const tenantId = this.tenantId(user);
    const entity = await this.getOwnedModel(user, id);
    if (entity.tenantId !== tenantId) {
      throw new NotFoundException('无权操作该模型');
    }
    return entity;
  }

  private normalizeBaseUrl(baseUrl: string) {
    return `${baseUrl || ''}`.trim().replace(/\/+$/, '');
  }

  private assertAdapterSupported(adapterType?: string | null) {
    const next = adapterType || AI_ADAPTER_OPENAI_COMPATIBLE;
    if (!isSupportedAiAdapter(next)) {
      throw new BadRequestException(`Unsupported AI adapter ${next}`);
    }
  }

  private async assertProviderCodeUnique(tenantId: number, code: string, excludeId?: string) {
    const existing = await this.providerRepo.findOne({
      where: { tenantId, code, deleteTime: IsNull() },
    });
    if (existing && `${existing.id}` !== `${excludeId || ''}`) {
      throw new BadRequestException('Provider code already exists');
    }
  }

  private async assertModelCodeUnique(
    tenantId: number,
    providerId: string,
    modelCode: string,
    excludeId?: string,
  ) {
    const existing = await this.modelRepo.findOne({
      where: { tenantId, providerId, modelCode, deleteTime: IsNull() },
    });
    if (existing && `${existing.id}` !== `${excludeId || ''}`) {
      throw new BadRequestException('Model code already exists under this provider');
    }
  }

  private async findFirstEnabledModelCode(user: UserType, providerId: string) {
    const tenantId = this.tenantId(user);
    const model = await this.modelRepo.findOne({
      where: [
        { tenantId, providerId, status: AI_STATUS_ENABLED, deleteTime: IsNull() },
        { tenantId: 0, providerId, status: AI_STATUS_ENABLED, deleteTime: IsNull() },
      ],
      order: { sort: 'ASC', id: 'ASC' },
    });
    return model?.modelCode || '';
  }
}
