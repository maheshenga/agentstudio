import Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  APP_NAME: Joi.string().default('nextjs-server'),
  APP_PORT: Joi.number().port().default(3000),
  APP_API_PREFIX: Joi.string()
    .pattern(/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/)
    .allow('')
    .default(''),
  // false = 只读模式（DebugGuard 禁止写操作）；true = 正常模式
  DEBUG: Joi.boolean().truthy('true').falsy('false').default(true),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(3306),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').default(''),
  DB_NAME: Joi.string().required(),
  DB_SYNC: Joi.boolean().truthy('true').falsy('false').default(false),
  DB_LOGGING: Joi.boolean().truthy('true').falsy('false').default(false),

  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('2h'),
  LOGIN_CAPTCHA_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),

  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_DB: Joi.number().integer().min(0).default(0),

  CORS_MODE: Joi.string().valid('off', 'all', 'open', 'list').default('off'),
  CORS_ORIGINS: Joi.when('CORS_MODE', {
    is: 'list',
    then: Joi.string().trim().min(1).required(),
    otherwise: Joi.string().allow('').default(''),
  }),
  CORS_CREDENTIALS: Joi.boolean().truthy('true').falsy('false').default(false),

  SAAS_DEV_PAYMENT_CONFIRM_ENABLED: Joi.boolean().truthy('true').falsy('false').optional(),

  ALIPAY_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
  ALIPAY_APP_ID: Joi.string().allow('').optional(),
  ALIPAY_PRIVATE_KEY: Joi.string().allow('').optional(),
  ALIPAY_PUBLIC_KEY: Joi.string().allow('').optional(),
  ALIPAY_NOTIFY_URL: Joi.string().allow('').optional(),
  ALIPAY_RETURN_URL: Joi.string().allow('').optional(),
  ALIPAY_GATEWAY_URL: Joi.string()
    .uri()
    .default('https://openapi-sandbox.dl.alipaydev.com/gateway.do'),

  SWAGGER_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
  SWAGGER_USERNAME: Joi.string().allow('').optional(),
  SWAGGER_PASSWORD: Joi.string().allow('').optional(),
  SWAGGER_TITLE: Joi.string().default('FssAdmin'),
  SWAGGER_DESCRIPTION: Joi.string().default('FssAdmin API 文档'),
  SWAGGER_VERSION: Joi.string().default('1.0.0'),

  FILE_STORAGE: Joi.string().valid('local', 'cos').default('local'),
  FILE_UPLOAD_DIR: Joi.string().default('../upload'),
  FILE_DOMAIN: Joi.string().default('http://localhost:3000'),
  FILE_SERVE_ROOT: Joi.string().default('/profile'),
  FILE_MAX_SIZE: Joi.number().integer().min(1).default(10),
  FILE_ALLOWED_EXTENSIONS: Joi.string().default('jpg,jpeg,png,gif,webp,bmp'),

  APP_PACKAGE_DIR: Joi.string().default('../upload/app-packages'),
  APP_PUBLIC_DIR: Joi.string().default('../upload/app-public'),
  APP_PUBLIC_PREFIX: Joi.string()
    .pattern(/^\/[A-Za-z0-9/_-]*\/$/)
    .default('/apps-static/'),
  APP_PACKAGE_MAX_SIZE_MB: Joi.number().integer().min(1).default(50),
  APP_PACKAGE_MAX_FILES: Joi.number().integer().min(1).default(500),
  APP_RUNTIME_STORAGE_DIR: Joi.string().default('../upload/app-runtime-data'),
  APP_RUNTIME_STORAGE_MAX_FILE_MB: Joi.number().integer().min(1).max(50).default(10),
  APP_RUNTIME_STORAGE_QUOTA_MB: Joi.number().integer().min(1).max(10240).default(100),
  APP_RUNTIME_STORAGE_ALLOWED_MIME_TYPES: Joi.string()
    .trim()
    .min(1)
    .default('text/plain,application/json,image/png,image/jpeg,image/webp,application/pdf'),
  APP_RUNTIME_IFRAME_LAUNCH_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
  APP_RUNTIME_LAUNCH_SECRET: Joi.when('APP_RUNTIME_IFRAME_LAUNCH_ENABLED', {
    is: true,
    then: Joi.string().min(32).required(),
    otherwise: Joi.string().allow('').default(''),
  }),
  APP_SERVICE_RUNTIME_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
  APP_SERVICE_RUNTIME_DIR: Joi.string().default('../upload/app-service-runtime'),
  APP_SERVICE_RUNTIME_USER: Joi.when('APP_SERVICE_RUNTIME_ENABLED', {
    is: true,
    then: Joi.string()
      .pattern(/^[a-z_][a-z0-9_-]{0,31}$/)
      .invalid('root')
      .required(),
    otherwise: Joi.string().allow('').default(''),
  }),
  APP_SERVICE_PM2_HOME: Joi.when('APP_SERVICE_RUNTIME_ENABLED', {
    is: true,
    then: Joi.string().trim().min(1).required(),
    otherwise: Joi.string().allow('').default(''),
  }),
  APP_SERVICE_PM2_COMMAND: Joi.string().trim().min(1).default('pm2'),
  APP_SERVICE_RUNTIME_INTERPRETER: Joi.string().valid('node', 'bun').default('node'),
  APP_SERVICE_MEMORY_MB: Joi.number().integer().min(128).max(2048).default(256),
  APP_SERVICE_REQUEST_TIMEOUT_MS: Joi.number().integer().min(1000).max(30000).default(15000),
  APP_SERVICE_MAX_BODY_MB: Joi.number().integer().min(1).max(10).default(2),
  APP_SERVICE_HEALTH_SUCCESS_COUNT: Joi.number().integer().min(1).max(10).default(3),
  APP_SERVICE_PORT_MIN: Joi.number().port().default(20000),
  APP_SERVICE_PORT_MAX: Joi.number()
    .port()
    .default(39999)
    .custom((value, helpers) => {
      const minimum = Number(helpers.state.ancestors[0]?.APP_SERVICE_PORT_MIN ?? 20000);
      return Number(value) - minimum >= 99 ? value : helpers.error('number.min');
    }),

  LOG_LEVEL: Joi.string().valid('fatal', 'error', 'warn', 'info', 'debug').default('info'),
  LOG_DIR: Joi.string().default('logs'),
  LOG_CONSOLE_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  LOG_FILE_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  LOG_HEALTH_LOG_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
  LOG_DEPENDENCY_CHECK_INTERVAL_MS: Joi.number().integer().min(1000).default(30000),
  LOG_MAX_FILE_SIZE_MB: Joi.number().min(1).default(20),
  LOG_RETENTION_DAYS: Joi.number().integer().min(1).default(30),

  /** AI 模块 API Key 加密密钥；未设置时回退 JWT_SECRET 派生 */
  AI_ENCRYPTION_KEY: Joi.string().min(32).optional(),

  /** 每 Worker 最大并发 LLM 流数，超出时返回 503 */
  AI_MAX_CONCURRENT_STREAMS: Joi.number().integer().min(1).max(999).default(10),

  TAIXU_QDRANT_URL: Joi.string().uri().optional(),
  TAIXU_QDRANT_COLLECTION_PREFIX: Joi.string().optional(),
  TAIXU_QDRANT_VECTOR_SIZE: Joi.number().integer().min(1).max(100000).optional(),
  TAIXU_QDRANT_TIMEOUT: Joi.number().integer().min(1).max(600).optional(),
  TAIXU_QDRANT_EMBED_BATCH: Joi.number().integer().min(1).max(512).optional(),

  TAIXU_GRAPH_ENABLED: Joi.boolean().truthy('true').falsy('false').optional(),
  TAIXU_GRAPH_CONCURRENCY: Joi.number().integer().min(1).max(32).optional(),
  TAIXU_GRAPH_CHUNK_SIZE: Joi.number().integer().min(200).max(20000).optional(),

  TAIXU_NEO4J_BOLT_URL: Joi.string().optional(),
  TAIXU_NEO4J_HTTP_URL: Joi.string().uri().optional(),
  TAIXU_NEO4J_USERNAME: Joi.string().optional(),
  TAIXU_NEO4J_PASSWORD: Joi.string().allow('').optional(),
  TAIXU_NEO4J_LABEL_PREFIX: Joi.string().optional(),

  TAIXU_DOC_SAVE_DIR: Joi.string().optional(),
  TAIXU_DOC_INDEX_REQUIRE_LOGIN: Joi.boolean().truthy('true').falsy('false').optional(),

  TAIXU_MCP_AMAP_KEY: Joi.string().allow('').optional(),
  TAIXU_TAVILY_API_KEY: Joi.string().allow('').optional(),

  TAIXU_LLM_PROVIDER: Joi.string().valid('openai', 'ollama').optional(),
  TAIXU_OPENAI_API_KEY: Joi.string().allow('').optional(),
  TAIXU_OPENAI_BASE_URL: Joi.string().allow('').optional(),
  TAIXU_OPENAI_MODEL: Joi.string().allow('').optional(),
  TAIXU_OPENAI_EMBEDDING_MODEL: Joi.string().allow('').optional(),
  TAIXU_OPENAI_IMAGE_MODEL: Joi.string().allow('').optional(),
  TAIXU_OLLAMA_BASE_URL: Joi.string().allow('').optional(),
  TAIXU_OLLAMA_MODEL: Joi.string().allow('').optional(),
  TAIXU_OLLAMA_EMBEDDING_MODEL: Joi.string().allow('').optional(),
});
