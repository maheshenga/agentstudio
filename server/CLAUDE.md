# nextjs-server 项目协作说明

本文档记录本项目的结构、约定和用户已确定的开发规则。后续在本项目中协作时，应优先遵循这里的项目级规则。

## 项目概述

`nextjs-server` 是一个基于 NestJS + TypeScript 的 Node.js 后端服务。

当前已集成能力：

- NestJS 应用基础结构
- TypeScript
- 多环境配置
- MySQL + TypeORM
- Redis + ioredis
- 结构化日志
- API 请求日志
- MySQL / Redis 依赖状态监控
- 本地日志文件查询 API
- API 自动验证命令和 Markdown 报告
- `@` 路径别名
- 统一工具函数出口 `src/utils/utils.ts`

## 技术栈约定

- 后端框架：NestJS
- 语言：TypeScript
- 包管理器：npm
- 数据库：MySQL
- ORM / 数据源：TypeORM DataSource
- Redis 客户端：ioredis
- 配置模块：`@nestjs/config`
- 环境变量校验：Joi
- 开发热重启：nodemon
- 工具函数依赖：`cross-env-plugins`

## 目录结构约定

```text
src/
├─ api-verifier/        # API 自动验证 CLI、执行器、报告生成
├─ config/              # 多环境配置与环境变量校验
├─ database/            # MySQL DataSource 模块
├─ logging/             # 日志模块、请求日志、日志查询 API
├─ modules/             # 业务模块
├─ redis/               # Redis 模块与 RedisService
├─ utils/               # 项目统一工具函数出口
├─ app.module.ts
└─ main.ts
```

业务模块统一放在：

```text
src/modules/<module-name>/
```

例如：

```text
src/modules/user/
src/modules/role/
```

横切能力或基础设施模块可以放在 `src/` 一级目录，例如：

```text
src/logging/
src/database/
src/redis/
src/api-verifier/
```

## API 路由规则

所有 API 必须统一走全局前缀。

全局前缀由环境变量控制：

```env
APP_API_PREFIX=api
```

默认接口前缀：

```text
/api
```

后续版本迭代时可以改为：

```env
APP_API_PREFIX=api_v2
APP_API_PREFIX=api_v3
```

对应接口变为：

```text
/api_v2/...
/api_v3/...
```

模块接口统一按以下格式设计：

```text
/api/{模块名}/{动作或资源}
```

示例：

```text
/api/user/list
/api/user/detail
/api/user/create
/api/log/query
/api/health
```

Nest Controller 中不要写全局前缀，只写模块名：

```ts
@Controller('user')
export class UserController {
  @Get('list')
  list() {}
}
```

## 路径别名规则

项目已配置 `@` 指向 `src` 根目录。

优先使用：

```ts
import { utils } from '@/utils/utils';
```

避免层级过深的相对路径，例如：

```ts
../../../utils/utils
```

## 环境配置规则

项目使用以下环境文件：

```text
.env
.env.development
.env.production
.env.example
```

加载顺序：

```text
.env.${NODE_ENV}
.env
```

规则：

- `.env.example` 是可提交 Git 的配置模板，必须包含所有需要配置的字段和注释。
- `.env.example` 中只能使用随机示例值或占位值，不能放真实密码、Token、生产连接串。
- 真实环境配置分别放在 `.env.development`、`.env.production`。
- `.env` 只放公共默认配置，不放具体环境的 MySQL / Redis 连接信息。
- 新增环境变量时，必须同步更新：
  - `src/config/configuration.ts`
  - `src/config/env.validation.ts`
  - `.env.example`
  - 对应环境文件

## MySQL / Redis 规则

- MySQL 和 Redis 连接失败不能阻断 Nest 服务启动。
- 连接状态通过健康检查和日志体现。
- 生产环境禁止开启 `DB_SYNC=true`。
- `DB_LOGGING=true` 仅建议开发排查时使用，生产环境应保持 `false`。
- Redis 操作统一通过 `src/redis/redis.service.ts`，不要在业务模块中直接创建 ioredis 客户端。

## 日志规则

项目已有统一日志模块：

```text
src/logging/
```

日志能力包括：

- 控制台日志
- 本地结构化日志文件
- API 请求日志
- 服务启动 / 生命周期日志
- MySQL / Redis 依赖状态日志
- 日志查询 API

日志文件规则：

```text
logs/YYYY/MM/DD/HH.jsonl
```

示例：

```text
logs/2026/06/07/00.jsonl
logs/2026/06/07/23.jsonl
```

单文件超过 `LOG_MAX_FILE_SIZE_MB` 后生成同小时分片：

```text
logs/YYYY/MM/DD/HH-02.jsonl
logs/YYYY/MM/DD/HH-03.jsonl
```

日志保留天数由以下配置控制：

```env
LOG_RETENTION_DAYS=30
```

日志查询接口：

```http
GET /api/log/query
```

日志查询基于本地文件扫描，适合初期排查；如果日志量变大，后续再扩展到 MySQL、ELK、Loki 等系统。

## API 自动验证规则

项目已有 API 验证模块：

```text
src/api-verifier/
```

验证命令：

```bash
npm run verify:api:dev
```

默认报告输出：

```text
logs/verify/api-verify-result-YYYYMMDDHHmmss.md
```

规则：

- API 验证用于初步检查接口是否可用，不替代完整业务测试。
- 默认只执行安全用例。
- 写操作、删除操作或有副作用的接口必须标记为 `unsafe`，只有显式允许时才执行。
- 新增模块时，如果需要加入 API 验证，应在模块目录下新增：

```text
<module-name>.api-verifier.ts
```

并注册到该模块的 `providers` 中。

只要该模块被 `AppModule` 引入，API 验证命令会自动收集对应验证用例。

## 工具函数规则

项目已接入：

```text
cross-env-plugins
```

但项目内不要直接从 `cross-env-plugins` 引用工具函数。

统一从以下文件引用：

```ts
import { utils } from '@/utils/utils';
```

统一出口文件：

```text
src/utils/utils.ts
```

规则：

- `src/utils/utils.ts` 默认聚合导出 `cross-env-plugins` 的 `utils` 能力。
- 如果 `cross-env-plugins` 已有对应方法，优先复用。
- 如果 `cross-env-plugins` 没有对应方法，直接在 `src/utils/utils.ts` 中扩展。
- 新增工具方法应职责单一、命名清晰，并做好必要边界校验。

## 命令规则

当前常用命令：

```bash
npm run dev
npm run dev:prd
npm run build
npm run build:prd
npm run verify:api
npm run verify:api:dev
```

说明：

- `npm run dev`：开发环境启动，使用 nodemon。
- `npm run build`：开发环境构建。
- `npm run build:prd`：生产环境构建。
- `npm run verify:api:dev`：先构建，再执行 API 验证。

新增命令时应保持命名简洁，不恢复大量无用脚本。

## 开发规则总结

- 新功能优先按模块组织，模块放在 `src/modules/<module-name>/`。
- Controller 路由只写模块名和动作名，不写 `/api` 前缀。
- 所有 API 都必须经过 `APP_API_PREFIX`。
- 新增配置必须同步更新配置读取、配置校验和 `.env.example` 注释。
- 新增工具函数统一走 `src/utils/utils.ts`。
- 新增 API 建议同步增加 `*.api-verifier.ts` 验证用例。
- MySQL / Redis 失败不能影响服务启动。
- 日志、验证报告、运行产物放在 `logs/` 下，不提交 Git。
- 不提交真实密钥、Token、生产密码或生产连接串。
