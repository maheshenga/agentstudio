export interface AppPageQuery {
  page?: number | string;
  limit?: number | string;
}

export interface AppPageResult<T> {
  list: T[];
  total: number;
  page: number;
  limit: number;
}

export function normalizeAppPage(query: AppPageQuery = {}) {
  const page = Math.max(1, Number(query.page || 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit || 20) || 20));
  return { page, limit, skip: (page - 1) * limit };
}
