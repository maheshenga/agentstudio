export const TAIXU_MODEL_TYPES = ['llm', 'embedding', 'medical', 'vision'] as const;
export const TAIXU_MODEL_SOURCES = ['ollama', 'modelscope', 'cloud', 'gitee'] as const;

export type TaixuModelType = (typeof TAIXU_MODEL_TYPES)[number];
export type TaixuModelSource = (typeof TAIXU_MODEL_SOURCES)[number];

export const TAIXU_MODEL_TYPE_LABELS: Record<TaixuModelType, string> = {
  llm: 'LLM',
  embedding: 'Embedding',
  medical: 'Medical',
  vision: 'Vision',
};

export const TAIXU_MODEL_SOURCE_LABELS: Record<TaixuModelSource, string> = {
  ollama: 'Ollama',
  modelscope: 'ModelScope',
  cloud: 'Cloud',
  gitee: 'Gitee',
};

export function getTaixuModelMeta() {
  return {
    types: TAIXU_MODEL_TYPES.map((value) => ({ value, label: TAIXU_MODEL_TYPE_LABELS[value] })),
    sources: TAIXU_MODEL_SOURCES.map((value) => ({ value, label: TAIXU_MODEL_SOURCE_LABELS[value] })),
  };
}

export function normalizeTaixuModelType(value?: string | null): TaixuModelType | null {
  const key = String(value || '').trim().toLowerCase();
  return (TAIXU_MODEL_TYPES as readonly string[]).includes(key) ? (key as TaixuModelType) : null;
}

export function normalizeTaixuModelSource(value?: string | null): TaixuModelSource | null {
  const key = String(value || '').trim().toLowerCase();
  return (TAIXU_MODEL_SOURCES as readonly string[]).includes(key) ? (key as TaixuModelSource) : null;
}
