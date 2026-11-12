# 变更日志

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)。

## v0.1.4

新增 **Token 使用趋势**：在设置里按天 / 按周 / 按月看 token 消耗。

### 新增

- `lib/token-usage.js`：读取 `~/.dsh/sessions/**/session*.jsonl.zstd`，按 zstd 帧结构逐帧解压（Node 的 `zstdDecompressSync` 只解第一帧），抽出 `assistant/message` 的 `data.usage`，按天（30 天）/ 周（12 周）/ 月（12 个月）分桶；按文件 mtime+size 缓存并只解压新增帧。
- Host：`/api/deepseek-balance/summary` 新增 `usage` 字段（总计、缓存命中率、三档分桶、数据源统计）；会话日志读取失败不影响余额主功能。
- Client：新增「Token 使用趋势」卡片 —— 堆叠柱状图（缓存命中 / 输入 / 输出）、悬停看单点明细、按天/按周/按月切换（选择记进 localStorage）、今日 / 本周 / 本月 / 缓存命中率四张指标卡。

### 验证

- 增量解析结果与 `zstd -dc` 独立统计逐项对平（630 条记录、总量 116,450,453 tokens）。
- 用 Node 里跑的迷你 React 运行时把整棵组件树渲染了一遍：卡片、柱状图、切换按钮、localStorage 落键均正常。

### 升级提示

Host 半边有改动，**需要重启 DeepSeek Harness** 才能看到 token 数据；之后改 Client 只需 `Cmd + R`。

## v0.1.3

解除 npm 发布限制，并把 npm 同名冲突写进文档。插件行为不变。

### 变更

- `package.json`：`"private": true` → `"false"`，包本身具备 `npm publish` 条件；版本 `0.1.2` → `0.1.3`。
- README：新增警告——npm 上 `dsh-plugin-deepseek-balance` 是他人（`fanlr`）发布的同名不同项目，请勿用裸包名安装；「发布（维护者）」补 npm 发布说明（需改用带 scope 的包名）。

### 说明

- 未发布到 npm：该包名已被占用（`fanlr/dsh-plugins`，v2.0.0），`npm publish` 会 403。分发仍走 GitHub（`github:` 安装）与 Release 的 tgz。

## v0.1.2

面向插件市场（DSH Plugin Hub）收录的元数据版本，插件行为不变。

### 变更

- `package.json`：`dsh.bundle.patch` 改为官方文档的规范写法 `"./cordis.patch.yml"`（DSH 同时接受有序数组，字符串形式对扫描器更明确）；版本 `0.1.1` → `0.1.2`。
- README 新增「这是什么」一节：明确本仓库是 DeepSeek Harness（DSH）插件，逐条列出 `dsh-plugin` topic、`dsh.bundle` 声明、导出 `apply(ctx)` 的插件模块、浏览器半边。
- README 安装命令改为收录要求的 `dsh plugin --profile web add <包名>` 形式（GitHub 源码安装），并补一行 `--dump-config` 校验命令。
- 仓库 Topics 追加 `deepseek-harness`。

### 验证

- `dsh plugin --profile <tmp> add`（tgz 与 `github:` 两种来源）后，`--dump-config` 均出现 `# == dsh-plugin-deepseek-balance` 层。

## v0.1.1

打包与分发版本：插件本身行为不变，补齐作为 DSH 组合包（bundle）发布所需的一切。

### 新增

- `npm run pack` 脚本：`npm pack` 产出 `dist/dsh-plugin-deepseek-balance-<version>.tgz`，可直接 `dsh plugin add`。
- `CHANGELOG.md`；`LICENSE` 加入 `files`，随包分发。
- README 补齐三种安装方式：发布包 tgz、`github:` 直接安装、本地 `link:` 开发；补卸载与维护者发布流程。

### 变更

- `package.json` 版本 `0.1.0` → `0.1.1`，新增 `engines.node >= 20`。
- `.gitignore` 忽略 `dist/`。

## v0.1.0

首个可用版本。

### 新增

- Host 半边 `lib/index.js`：`GET /api/deepseek-balance/summary`、`POST /api/deepseek-balance/budget`，读取 DeepSeek `/user/balance`，每 10 分钟后台补采样，历史与预算写入 `~/.dsh/deepseek-balance/`。
- Client 半边 `lib/client.js`：注册 `settings.section`「余额」，环形仪表、余额构成、消耗指标、24h/7d/30d/全部四档趋势。
- `cordis.patch.yml`：作为 profile 组合包被引入时插入 Loader 树。
- API Key 仅在 Host 进程读取，浏览器只拿数字。
