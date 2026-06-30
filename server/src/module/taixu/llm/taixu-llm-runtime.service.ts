import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { TaixuSystemModelEntity } from '../model/entities/taixu-system-model.entity';
import { TaixuHistoryRecordEntity } from '../history/entities/taixu-history-record.entity';
import { TaixuSettingService } from '../setting/taixu-setting.service';
import { applyTenantFilter, appendTenantWhere, getTenantId } from '../../../common/utils/tenant.util';
import {
  mergeTaixuConfig,
  pickTaixuLlmConnectConfig,
  pickTaixuRagConnectConfig,
  toTaixuLlmRuntimeConfig,
  type TaixuLlmConnectConfig,
  type TaixuLlmRuntimeConfig,
  type TaixuRagConnectConfig,
} from './taixu-llm-config.util';
import { TaixuLlmService } from './taixu-llm.service';

export type { TaixuLlmConnectConfig, TaixuLlmRuntimeConfig, TaixuRagConnectConfig };

@Injectable()
export class TaixuLlmRuntimeService {
  constructor(
    @InjectRepository(TaixuSystemModelEntity)
    private readonly modelRepo: Repository<TaixuSystemModelEntity>,
    @InjectRepository(TaixuHistoryRecordEntity)
    private readonly historyRepo: Repository<TaixuHistoryRecordEntity>,
    private readonly settingService: TaixuSettingService,
    private readonly llmService: TaixuLlmService,
  ) {}

  private requireTenantId(): number {
    const tenantId = getTenantId();
    if (!tenantId) throw new UnauthorizedException('Unauthorized');
    return tenantId;
  }

  /**
   * 将模型实体转换为连接配置。
   * @param entity - 系统模型实体
   * @returns LLM 连接配置
   */
  private entityToConnectConfig(entity: TaixuSystemModelEntity): TaixuLlmConnectConfig {
    return {
      sourceId: entity.id,
      model: entity.modelId || entity.modelName || undefined,
      type: entity.source || undefined,
      baseUrl: entity.baseUrl || undefined,
      apiKey: entity.apiKey || undefined,
    };
  }

  private async getModelById(modelId: string) {
    this.requireTenantId();
    if (!modelId) return null;
    return this.modelRepo.findOne({ where: appendTenantWhere({ id: modelId }) });
  }

  /**
   * 获取指定类型的最新模型。
   * @param type - 模型类型（llm 或 embedding）
   * @returns 最新模型实体，不存在时返回 null
   */
  private async getLatestModelByType(type: 'llm' | 'embedding') {
    this.requireTenantId();
    const qb = this.modelRepo.createQueryBuilder('m');
    applyTenantFilter(qb, 'm');
    qb.andWhere('m.type = :type', { type });
    qb.orderBy('m.createTime', 'DESC');
    return qb.getOne();
  }

  /**
   * 获取对话历史中的模型 ID。
   * @param sourceId - 来源 ID（可选）
   * @returns 包含 chatModelId 的对象
   */
  private async getDialogModelIds(sourceId?: string) {
    this.requireTenantId();
    if (!sourceId) return { chatModelId: undefined };
    const row = await this.historyRepo.findOne({ where: appendTenantWhere({ id: sourceId }) });
    return { chatModelId: row?.chatModelId || undefined };
  }

  /** 对齐 taixu：t_system_setting(source=llm) 为底，请求体字段有值时才覆盖 */
  async resolveLlmSettingContent(override?: TaixuLlmConnectConfig | Record<string, any>) {
    const row = await this.settingService.detail('llm');
    const fromSetting = pickTaixuLlmConnectConfig((row?.content ?? {}) as Record<string, any>);
    const picked = pickTaixuLlmConnectConfig(override);
    return mergeTaixuConfig(fromSetting, picked);
  }

  /** 对齐 taixu：t_system_setting(source=rag) 为底，请求体字段有值时才覆盖 */
  async resolveRagSettingContent(override?: TaixuRagConnectConfig | Record<string, any>) {
    const row = await this.settingService.detail('rag');
    const fromSetting = pickTaixuRagConnectConfig((row?.content ?? {}) as Record<string, any>);
    const picked = pickTaixuRagConnectConfig(override);
    return mergeTaixuConfig(fromSetting, picked);
  }

  /**
   * 解析对话模型的运行配置。优先级：请求体 > 设置 > 对话历史 > 最新 LLM 模型。
   * @param args - 包含来源 ID、对话模型 ID 和 LLM 连接配置的参数
   * @returns 运行时配置，无法解析时返回 null
   */
  async resolveChatModel(args: {
    sourceId?: string;
    chatModelId?: string;
    llm?: TaixuLlmConnectConfig | Record<string, any>;
  }): Promise<TaixuLlmRuntimeConfig | null> {
    const merged = await this.resolveLlmSettingContent(args.llm);
    const fromRequest = toTaixuLlmRuntimeConfig(merged, this.llmService.getProvider());
    if (fromRequest) return fromRequest;

    const modelId = String(args.chatModelId || merged.sourceId || '').trim();
    if (modelId) {
      const entity = await this.getModelById(modelId);
      if (entity) {
        const cfg = toTaixuLlmRuntimeConfig(this.entityToConnectConfig(entity), this.llmService.getProvider());
        if (cfg) return cfg;
      }
    }

    const fromDialog = await this.getDialogModelIds(args.sourceId);
    if (fromDialog.chatModelId) {
      const entity = await this.getModelById(fromDialog.chatModelId);
      if (entity) {
        const cfg = toTaixuLlmRuntimeConfig(this.entityToConnectConfig(entity), this.llmService.getProvider());
        if (cfg) return cfg;
      }
    }

    const latest = await this.getLatestModelByType('llm');
    if (latest) {
      return toTaixuLlmRuntimeConfig(this.entityToConnectConfig(latest), this.llmService.getProvider());
    }
    return null;
  }

  /**
   * 解析 Embedding 模型的运行配置。优先级：设置 > 指定模型 ID > 最新 Embedding 模型。
   * @param args - 可选的 RAG 连接配置
   * @returns 运行时配置，无法解析时返回 null
   */
  async resolveEmbeddings(args?: { rag?: TaixuRagConnectConfig | Record<string, any> }) {
    const merged = await this.resolveRagSettingContent(args?.rag);
    const fromSetting = toTaixuLlmRuntimeConfig(merged, this.llmService.getProvider());
    if (fromSetting?.model) return fromSetting;

    const modelId = String(merged.sourceId || '').trim();
    if (modelId) {
      const entity = await this.getModelById(modelId);
      if (entity) {
        const cfg = toTaixuLlmRuntimeConfig(this.entityToConnectConfig(entity), this.llmService.getProvider());
        if (cfg) return cfg;
      }
    }

    const latest = await this.getLatestModelByType('embedding');
    if (!latest) return null;
    return toTaixuLlmRuntimeConfig(this.entityToConnectConfig(latest), this.llmService.getProvider());
  }

  /**
   * 创建对话模型实例。内部调用 resolveChatModel 解析配置后创建。
   * @param args - 包含来源 ID、对话模型 ID 和 LLM 连接配置的参数
   * @returns LangChain 对话模型实例
   */
  async newChatModel(args: {
    sourceId?: string;
    chatModelId?: string;
    llm?: TaixuLlmConnectConfig | Record<string, any>;
  }): Promise<BaseChatModel> {
    const cfg = await this.resolveChatModel(args);
    if (!cfg?.model) {
      throw new Error('LLM 未配置，请先在设置管理保存文本模型');
    }
    return this.llmService.newChatModel(cfg);
  }

  /**
   * 创建 Embedding 模型实例。内部调用 resolveEmbeddings 解析配置后创建。
   * @param args - 可选的来源 ID 和 RAG 连接配置
   * @returns LangChain Embedding 模型实例
   */
  async newEmbeddings(args?: { sourceId?: string; rag?: TaixuRagConnectConfig | Record<string, any> }) {
    void args?.sourceId;
    const cfg = await this.resolveEmbeddings({ rag: args?.rag });
    if (!cfg?.model) {
      throw new Error('Embedding 模型未配置，请在管理后台「模型管理」添加 Embedding 模型并保存');
    }
    return this.llmService.newEmbeddings(cfg);
  }
}
