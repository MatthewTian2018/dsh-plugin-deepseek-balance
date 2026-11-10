# dsh-plugin-deepseek-balance

DeepSeek 余额仪表盘插件 —— 在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）的「设置 → 余额」里查看账户余额、余额构成、消耗速度与余额趋势。

```
设置 → 余额
┌──────────────────────────────────────────────┐
│  DeepSeek 余额                    ● 实时      │
│  ┌────────┐   总余额 ¥86.05                   │
│  │  86%   │   赠金 ¥5.82 · 充值 ¥80.22        │
│  └────────┘   预算 ¥100                       │
│  日均消耗 ¥1.28   可用约 67 天                 │
│  趋势 ────╲╱────  24 小时 / 7 天 / 30 天 / 全部 │
└──────────────────────────────────────────────┘
```

## 功能

- **环形仪表**：以预算为分母显示当前余额占比，预算可在页面内直接改（防抖 450 ms 落盘）。
- **余额构成**：区分充值余额与赠送余额，多币种按币种符号显示（CNY / USD / EUR / JPY）。
- **消耗指标**：日均消耗、按当前速率可用的天数、预算剩余、距上次快照时间。
- **余额趋势**：24 小时 / 7 天 / 30 天 / 全部四档，鼠标悬停看单点数值，宽度自适应（ResizeObserver）。
- **后台采样**：Host 每 10 分钟补一次快照，即使不打开设置页，趋势也不断档。
- **本地优先**：Key、历史、预算全部留在本机，浏览器只拿到数字。

## 组成

| 半边 | 文件 | 作用 |
| --- | --- | --- |
| Host | `lib/index.js` | 挂 `GET /api/deepseek-balance/summary`、`POST /api/deepseek-balance/budget`；请求 DeepSeek `/user/balance`；落盘采样历史 |
| Client | `lib/client.js` | 注册 `settings.section`：「余额」分区，环形仪表 / 构成 / 趋势 / 指标 |
| Bundle | `cordis.patch.yml` | 被 profile 作为组合包（bundle）引入时，把自己插进 Loader 树 |

本包是一个**组合包**：`package.json` 里 `dsh.bundle.patch` 指向 `cordis.patch.yml`，被 profile 的 `dsh.profile.bundles` 列出时生效。

## 安装

要求：DSH 已能正常启动，且本机已配置可用的 DeepSeek API Key。验证环境：DSH `0.2.2-rc.1`（桌面端 / web 端同一套 profile 机制）。

三种装法，任选其一。装完都需要**重启 DeepSeek Harness**，插件才会被 Loader 挂载。

> 本包刻意没有声明 `engines.dsh`。DSH 在缺少该字段时退回检查 `@deepseek-ai/dsh*` peer 依赖范围，而本包只 peer 了 `@deepseek-ai/cordis: *`，因此不会被版本号（尤其是 `-rc` 预发布号）拒装；实际验证环境见上方说明。

### 方式一：发布包（推荐）

从 [Releases](https://github.com/MatthewTian2018/dsh-plugin-deepseek-balance/releases/latest) 下载 `.tgz`，然后用 DSH 的插件命令装进目标 profile：

```bash
dsh plugin --profile desktop add ./dsh-plugin-deepseek-balance-0.1.1.tgz
```

装完的 profile `package.json` 会多出依赖，`dsh.profile.bundles` 末尾会追加 `dsh-plugin-deepseek-balance`：

```json
{
  "dependencies": { "dsh-plugin-deepseek-balance": "file:./dsh-plugin-deepseek-balance-0.1.1.tgz" },
  "dsh": { "profile": { "bundles": ["@deepseek-ai/dsh-base", "…", "dsh-plugin-deepseek-balance"] } }
}
```

### 方式二：直接从 GitHub 装

```bash
dsh plugin --profile desktop add github:MatthewTian2018/dsh-plugin-deepseek-balance
```

本包**没有 `prepare` / 构建脚本**（`lib/` 里就是可运行源码），所以 pnpm 不会向你索要 `allowBuilds` 授权，省掉这一步。生产环境建议锁 commit：

```bash
dsh plugin --profile desktop add github:MatthewTian2018/dsh-plugin-deepseek-balance#<sha>
```

### 方式三：本地目录（改代码用）

图形界面：设置 → 插件 → 安装，填本地路径 `/path/to/dsh-plugin-deepseek-balance`。

或手动：

```bash
git clone https://github.com/MatthewTian2018/dsh-plugin-deepseek-balance.git
cd ~/.dsh/profiles/desktop
pnpm add link:/path/to/dsh-plugin-deepseek-balance   # link: 便于改代码即时生效
```

再把包名加进该 profile `package.json` 的 `dsh.profile.bundles`：

```json
{
  "dsh": { "profile": { "bundles": ["dsh-plugin-deepseek-balance"] } }
}
```

> 用 `link:`（符号链接）而不是 `file:`：`file:` 会硬链一份副本，改代码不会生效。

### 卸载

```bash
dsh plugin --profile desktop remove dsh-plugin-deepseek-balance
```

## 配置

API Key 只在 Host 进程读取，按以下顺序：

1. 环境变量 `DEEPSEEK_API_KEY`
2. `~/.dsh/.credentials.yaml`（DSH 自己的凭证文件）

| 环境变量 | 默认值 | 说明 |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | 自动读取 | 显式指定 Key |
| `DEEPSEEK_API_BASE` | `https://api.deepseek.com` | 接口地址 |

数据文件（都不进仓库）：

- `~/.dsh/deepseek-balance/history.json` —— 余额采样，最多 20 000 条，新采样与上一条间隔 < 45 s 时合并
- `~/.dsh/deepseek-balance/config.json` —— 预算（默认 100）

## 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/deepseek-balance/summary?force=1` | 余额 + 趋势 + 指标 + 预算；15 s 缓存，`force=1` 跳过 |
| `POST` | `/api/deepseek-balance/budget` | `{"budget": 100}`，仅接受 POST |

两条路由挂在 DSH 自身的鉴权之后：未带登录 cookie 一律 401，且只监听回环地址。

## 安全

- Key 绝不下发浏览器；前端只拿余额、趋势、预算这些数字。
- 不写任何远程服务；除了 `api.deepseek.com`，插件不发起其它请求。

## 已知限制

- DeepSeek 余额接口只返回当前快照，**历史是本插件采样出来的**，装完当天曲线从零开始积累。
- `settings.section` 是设置页的一个分区，所以仪表盘长在设置里，不是独立主页面。
- 后台采样依赖 DSH 进程常驻；关闭 DSH 期间不会有采样点。

## 开发

两份代码的生效方式不同：

| 改动 | 生效方式 | 原因 |
| --- | --- | --- |
| `lib/client.js` | 保存后 `Cmd + R` 刷新 | 前端 bundle 由 Loader 在页面启动时装配 |
| `lib/index.js` | 重启 DeepSeek Harness | Host 半边走 ESM 模块缓存，热替换拿不到新代码 |

调试 Host 路由：

```bash
curl -s http://127.0.0.1:<port>/api/deepseek-balance/summary | head -c 400
# 未登录 cookie 会返回 401，属预期：先 GET /?token=<launch token> 换 cookie
```

数据目录 `~/.dsh/deepseek-balance/` 可以直接删掉重置，插件会重新建。

## 发布（维护者）

```bash
# 1. 改版本号（package.json）与 CHANGELOG.md
# 2. 打包装进 dist/，先 dry-run 确认清单
npm pack --dry-run
npm run pack                                  # → dist/dsh-plugin-deepseek-balance-<version>.tgz

# 3. 推代码、打 tag、建 Release 并挂上 tgz
git add -A && git commit -m "chore: release v<version>"
git push origin main
git tag v<version> && git push origin v<version>
gh release create v<version> dist/dsh-plugin-deepseek-balance-<version>.tgz \
  --title "v<version>" --notes-file <(sed -n '/^## v<version>/,/^## v/p' CHANGELOG.md | head -n -1)
```

`files` 字段决定包里带什么（`lib/`、`cordis.patch.yml`、`README.md`、`LICENSE`），`package.json` 自动带上；`dist/`、`node_modules/` 不进包也不进仓库。

## License

[MIT](./LICENSE)
