# Repository Guidelines

## 项目结构与模块组织
- 当前目录：`docs/` 内含 PRD、技术设计、任务计划；后续代码存放 `src/`。建议结构：`src/index.ts` 为入口，`src/services/` 存放 `bot.ts`、`listener.ts`、`api.ts`，`src/db/supabase.ts` 封装存储，`src/utils/formatter.ts` 处理消息格式。
- 建议建立 `tests/` 或 `__tests__/` 目录，使用 `*.test.ts` 命名，业务脚本与测试一一对应。
- 静态资源（若有）放入 `assets/`；环境配置使用根目录 `.env`（不入库），提供 `.env.example` 说明必填项。

## 构建、测试与开发命令
- `npm install`：初始化依赖（推荐 Node.js ≥ 18）。
- `npm run dev`：使用 `tsx src/index.ts` 或 `nodemon --watch src --exec ts-node src/index.ts` 热重载本地运行。
- `npm run build`：`tsc` 编译到 `dist/`。
- `npm start`：`node dist/index.js` 以生产模式启动。
- 运行前确保 `.env` 包含 `SUPABASE_URL`, `SUPABASE_KEY`, `POLYGON_WSS`, `TELEGRAM_BOT_TOKEN`。

## 编码风格与命名约定
- 语言：TypeScript，默认开启 `strict`。缩进 2 空格，使用 `;` 结束语句，优先 `const`，必要时 `let`。
- 文件命名使用小写短横线或全小写，如 `watchlist-store.ts`；类型与接口用帕斯卡命名（`TradeEvent`），函数/变量使用小驼峰（`processTrade`）。
- 建议配置 ESLint + Prettier（`npm run lint` / `npm run format`），规则以 `@typescript-eslint/recommended` 为基础。

## 测试指引
- 测试框架建议 Vitest 或 Jest，测试文件命名 `*.test.ts`，放置在与源码同级的 `__tests__/` 或 `tests/` 中。
- 优先覆盖核心路径：Supabase CRUD、链上监听过滤逻辑、Polymarket API 重试与时间窗口匹配、消息格式化。
- 目标：关键模块语句/分支覆盖率 ≥ 80%；新增功能需附带最小可复现的测试或脚本（哪怕是集成脚本）。
- 运行：`npm test`（结合 `vitest run --coverage` 或 `jest --coverage`）；本地验证监听可通过模拟事件或录制日志回放。

## 提交与 Pull Request 规范
- 提交信息遵循简化 Conventional Commits：`feat: ...`，`fix: ...`，`chore: ...`，`docs: ...`，`test: ...`。保持一提交一主题，避免混合重构与功能。
- PR 模板（自述）：背景/动机、变更点列表、测试方式（命令与结果）、风险与回退方案；与 Issue 关联使用 `Closes #id`。
- 对涉及机器人输出的改动，附上示例日志或截图（敏感信息脱敏），便于审核。

## 安全与配置提示
- `.env`、密钥、Supabase 服务密钥、Telegram Token 不得入库或打印到日志；在生产日志中仅保留必要的哈希后缀。
- 链上与 API 节流：监听端使用指数退避重连；Polymarket API 调用遵循文档建议的频率，必要时增加缓存或请求队列。
- 部署请使用 `pm2` 或 `systemd` 持续运行，并开启健康检查；异常崩溃需记录到集中日志（如 Supabase `system_logs` 或外部 APM）。
