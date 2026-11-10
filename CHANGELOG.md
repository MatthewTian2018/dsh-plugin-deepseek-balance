# 变更日志

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)。

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
