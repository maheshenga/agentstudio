import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import type { TaixuLlmRuntimeConfig } from './taixu-llm-config.util';

export type TaixuLlmProvider = 'openai' | 'ollama';

/** @deprecated use TaixuLlmRuntimeConfig from taixu-llm-config.util */
export type TaixuRuntimeModelConfig = TaixuLlmRuntimeConfig;

@Injectable()
export class TaixuLlmService {
  constructor(private readonly configService: ConfigService) {}

  getProvider(): TaixuLlmProvider {
    return (this.configService.get<string>('taixu.llm.provider') as TaixuLlmProvider) || 'ollama';
  }

  private normalizeOpenAiBaseUrl(baseUrl?: string): string | undefined {
    const raw = String(baseUrl || '').trim();
    if (!raw) return undefined;
    return raw.replace(/\/$/, '');
  }

  /**
   * 根据运行配置创建对话模型实例。支持 OpenAI 兼容 API 和 Ollama。
   * @param runtime - 运行时配置，包含 provider、apiKey、baseUrl、model 和 temperature
   * @returns LangChain 对话模型实例
   */
  newChatModel(runtime?: TaixuLlmRuntimeConfig): BaseChatModel {
    const provider = runtime?.provider || this.getProvider();
    const temperature = runtime?.temperature ?? 0.2;
    if (provider === 'openai') {
      const apiKey =
        runtime?.apiKey ||
        this.configService.get<string>('taixu.llm.openai.apiKey') ||
        process.env.OPENAI_API_KEY ||
        '';
      if (!apiKey.trim()) {
        throw new Error('模型 ApiKey 未配置，请在模型管理或环境变量中设置');
      }
      const baseURL = this.normalizeOpenAiBaseUrl(
        runtime?.baseUrl ||
          this.configService.get<string>('taixu.llm.openai.baseUrl') ||
          process.env.OPENAI_BASE_URL ||
          undefined,
      );
      const model = runtime?.model || this.configService.get<string>('taixu.llm.openai.model') || 'gpt-4o-mini';
      return new ChatOpenAI({
        apiKey,
        configuration: baseURL ? { baseURL } : undefined,
        model,
        temperature,
      });
    }
    const baseUrl =
      runtime?.baseUrl || this.configService.get<string>('taixu.llm.ollama.baseUrl') || 'http://localhost:11434';
    const model = runtime?.model || this.configService.get<string>('taixu.llm.ollama.model') || 'llama3';
    return new ChatOllama({ baseUrl, model, temperature });
  }

  /**
   * 根据运行配置创建 Embedding 模型实例。支持 OpenAI 兼容 API 和 Ollama。
   * @param runtime - 运行时配置，包含 provider、apiKey、baseUrl、model 和 dimensions
   * @returns LangChain Embedding 模型实例
   */
  newEmbeddings(runtime?: TaixuLlmRuntimeConfig) {
    const provider = runtime?.provider || this.getProvider();
    if (provider === 'openai') {
      const apiKey =
        runtime?.apiKey ||
        this.configService.get<string>('taixu.llm.openai.apiKey') ||
        process.env.OPENAI_API_KEY ||
        '';
      const baseURL = this.normalizeOpenAiBaseUrl(
        runtime?.baseUrl ||
          this.configService.get<string>('taixu.llm.openai.baseUrl') ||
          process.env.OPENAI_BASE_URL ||
          undefined,
      );
      const model =
        runtime?.model ||
        this.configService.get<string>('taixu.llm.openai.embeddingModel') ||
        'text-embedding-3-small';
      // 显式传 dimensions：Qwen3-Embedding 等支持 MRL，输出需与 Qdrant 集合维度一致
      const dimensions = runtime?.dimensions;
      return new OpenAIEmbeddings({
        apiKey,
        configuration: baseURL ? { baseURL } : undefined,
        model,
        ...(dimensions ? { dimensions } : {}),
      });
    }
    const baseUrl =
      runtime?.baseUrl || this.configService.get<string>('taixu.llm.ollama.baseUrl') || 'http://localhost:11434';
    const model = runtime?.model || this.configService.get<string>('taixu.llm.ollama.embeddingModel') || 'nomic-embed-text';
    return new OllamaEmbeddings({ baseUrl, model });
  }
}
