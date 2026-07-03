const routerWhitelist = [
  { path: '/api/core/captcha', method: 'GET' },
  { path: '/api/core/login-captcha', method: 'GET' },
  { path: '/api/core/login', method: 'POST' },
  { path: '/api/core/logout', method: 'POST' },
  { path: '/api/core/refresh', method: 'POST' },
  { path: '/api/core/register', method: 'POST' },
  { path: '/api/core/registerUser', method: 'GET' },
  { path: '/api/core/tenants-by-username', method: 'GET' },
  { path: '/api/core/config/public/:key', method: 'GET' },
  { path: '/api/system/user/export', method: 'POST' },
  { path: '/api/system/role/export', method: 'POST' },
  { path: '/api/system/post/export', method: 'POST' },
  { path: '/api/system/dept/export', method: 'POST' },
  { path: '/api/system/config/export', method: 'POST' },
  { path: '/api/system/dict/type/export', method: 'POST' },
  { path: '/api/system/dict/data/export', method: 'POST' },
  { path: '/api/monitor/loginlog/export', method: 'POST' },
  { path: '/api/monitor/operlog/export', method: 'POST' },
  { path: '/api/monitor/online/export', method: 'POST' },
  { path: '/api/health', method: 'GET' },
  { path: '/api/log/query', method: 'GET' },
];

export default () => ({
  app: {
    name: process.env.APP_NAME ?? 'nextjs-server',
    env: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.APP_PORT ?? 3000),
    apiPrefix: process.env.APP_API_PREFIX ?? '',
    // DEBUG=false 时进入只读模式（禁止写操作）；默认 true
    debug: process.env.DEBUG !== 'false',
  },
  database: {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    username: process.env.DB_USERNAME ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    name: process.env.DB_NAME ?? 'nestjs',
    synchronize: process.env.DB_SYNC === 'true',
    logging: process.env.DB_LOGGING === 'true',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? '',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '2h',
  },
  redis: {
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.REDIS_DB ?? 0),
  },
  cors: {
    mode: process.env.CORS_MODE ?? 'off',
    origins: (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: process.env.CORS_CREDENTIALS === 'true',
  },
  payment: {
    alipay: {
      enabled: process.env.ALIPAY_ENABLED === 'true',
      appId: process.env.ALIPAY_APP_ID ?? '',
      privateKey: process.env.ALIPAY_PRIVATE_KEY ?? '',
      publicKey: process.env.ALIPAY_PUBLIC_KEY ?? '',
      notifyUrl: process.env.ALIPAY_NOTIFY_URL ?? '',
      returnUrl: process.env.ALIPAY_RETURN_URL ?? '',
      gatewayUrl: process.env.ALIPAY_GATEWAY_URL ?? 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
    },
  },
  swagger: {
    enabled: process.env.SWAGGER_ENABLED === 'true',
    username: process.env.SWAGGER_USERNAME ?? '',
    password: process.env.SWAGGER_PASSWORD ?? '',
    title: process.env.SWAGGER_TITLE ?? 'FssAdmin',
    description: process.env.SWAGGER_DESCRIPTION ?? 'FssAdmin API 文档',
    version: process.env.SWAGGER_VERSION ?? '1.0.0',
  },
  file: {
    storage: process.env.FILE_STORAGE ?? 'local',
    uploadDir: process.env.FILE_UPLOAD_DIR ?? '../upload',
    domain: process.env.FILE_DOMAIN ?? 'http://localhost:3000',
    serveRoot: process.env.FILE_SERVE_ROOT ?? '/profile',
    maxSize: Number(process.env.FILE_MAX_SIZE ?? 10),
    allowedExtensions: (process.env.FILE_ALLOWED_EXTENSIONS ?? 'jpg,jpeg,png,gif,webp,bmp')
      .split(',')
      .map((ext) => ext.trim().toLowerCase())
      .filter(Boolean),
  },
  log: {
    level: process.env.LOG_LEVEL ?? 'info',
    dir: process.env.LOG_DIR ?? 'logs',
    consoleEnabled: process.env.LOG_CONSOLE_ENABLED !== 'false',
    fileEnabled: process.env.LOG_FILE_ENABLED !== 'false',
    healthLogEnabled: process.env.LOG_HEALTH_LOG_ENABLED === 'true',
    dependencyCheckIntervalMs: Number(process.env.LOG_DEPENDENCY_CHECK_INTERVAL_MS ?? 30000),
    maxFileSizeMb: Number(process.env.LOG_MAX_FILE_SIZE_MB ?? 20),
    retentionDays: Number(process.env.LOG_RETENTION_DAYS ?? 30),
  },
  memory: {
    // ponytail: Bun 基线 RSS 高于 Node，默认阈值按运行时区分；生产 PM2 可配 MEMORY_FATAL_EXIT=true
    rssWarnMb: Number(
      process.env.MEMORY_RSS_WARN_MB ??
        ((process.versions as { bun?: string }).bun ? 768 : 300),
    ),
    rssFatalMb: Number(
      process.env.MEMORY_RSS_FATAL_MB ??
        ((process.versions as { bun?: string }).bun ? 1536 : 450),
    ),
    heapUsageWarn: Number(process.env.MEMORY_HEAP_WARN_PERCENT ?? 85),
    heapUsageFatal: Number(process.env.MEMORY_HEAP_FATAL_PERCENT ?? 95),
    fatalExit:
      process.env.MEMORY_FATAL_EXIT === 'true' ||
      (process.env.NODE_ENV === 'production' && process.env.MEMORY_FATAL_EXIT !== 'false'),
    /** Bun 下 RSS 不能反映真实堆压力，致命判断以堆使用率为主 */
    rssFatalEnabled: process.env.MEMORY_RSS_FATAL_ENABLED !== 'false' &&
      !(process.versions as { bun?: string }).bun,
  },
  perm: {
    router: {
      whitelist: routerWhitelist,
    },
  },
  taixu: {
    qdrant: {
      url: process.env.TAIXU_QDRANT_URL ?? '',
      collectionPrefix: process.env.TAIXU_QDRANT_COLLECTION_PREFIX ?? 'taixu_rag_',
      vectorSize: Number(process.env.TAIXU_QDRANT_VECTOR_SIZE ?? 1024),
      timeout: Number(process.env.TAIXU_QDRANT_TIMEOUT ?? 30),
      // 向量入库每批文本数：复用同一 store/embeddings，顺序写入（不加并发）
      embedBatch: Number(process.env.TAIXU_QDRANT_EMBED_BATCH ?? 64),
    },
    neo4j: {
      boltUrl: process.env.TAIXU_NEO4J_BOLT_URL ?? '',
      httpUrl: process.env.TAIXU_NEO4J_HTTP_URL ?? '',
      username: process.env.TAIXU_NEO4J_USERNAME ?? '',
      password: process.env.TAIXU_NEO4J_PASSWORD ?? '',
      labelPrefix: process.env.TAIXU_NEO4J_LABEL_PREFIX ?? '',
    },
    graph: {
      // LLM 实体关系图总开关（默认关闭以提速入库；需要时设为 true 再开启）
      enabled: String(process.env.TAIXU_GRAPH_ENABLED ?? 'false').toLowerCase() === 'true',
      // 开启时图谱抽取的并发数（对齐 taixu ThreadPoolExecutor）
      concurrency: Number(process.env.TAIXU_GRAPH_CONCURRENCY ?? 5),
      // 图谱抽取使用更粗的分块以减少 LLM 调用次数（向量分块仍用 rag.chunkSize）
      chunkSize: Number(process.env.TAIXU_GRAPH_CHUNK_SIZE ?? 2400),
    },
    documents: {
      saveDir: process.env.TAIXU_DOC_SAVE_DIR ?? '',
      // 默认 false：后台索引不依赖前台登录会话；设为 true 则恢复旧行为
      indexRequireLogin: String(process.env.TAIXU_DOC_INDEX_REQUIRE_LOGIN ?? 'false').toLowerCase() === 'true',
    },
    mcp: {
      amapKey: process.env.TAIXU_MCP_AMAP_KEY ?? '',
    },
    tavily: {
      apiKey: process.env.TAIXU_TAVILY_API_KEY ?? '',
    },
    llm: {
      provider: process.env.TAIXU_LLM_PROVIDER ?? 'ollama',
      openai: {
        apiKey: process.env.TAIXU_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY ?? '',
        baseUrl: process.env.TAIXU_OPENAI_BASE_URL ?? process.env.OPENAI_BASE_URL ?? '',
        model: process.env.TAIXU_OPENAI_MODEL ?? 'gpt-4o-mini',
        embeddingModel: process.env.TAIXU_OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
      },
      ollama: {
        baseUrl: process.env.TAIXU_OLLAMA_BASE_URL ?? 'http://localhost:11434',
        model: process.env.TAIXU_OLLAMA_MODEL ?? 'llama3',
        embeddingModel: process.env.TAIXU_OLLAMA_EMBEDDING_MODEL ?? 'nomic-embed-text',
      },
    },
    image: {
      openaiModel: process.env.TAIXU_OPENAI_IMAGE_MODEL ?? 'gpt-image-1',
    },
  },
});
