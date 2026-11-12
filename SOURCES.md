# 出处（Sources）

每条结论都要能追溯。本文件记录"这个说法是怎么来的"，格式统一为：**结论 → 证据类型 → 位置 → 实测版本/日期**。

证据类型：
- `code` — 直接读实现（安装包内 asar 或已安装插件）
- `doc` — 官方文档 / 第三方规范
- `measured` — 在本机实际扫描/运行得到的统计
- `issue` — 上游 issue / PR 讨论

## 官方契约面

| 结论 | 类型 | 位置 | 版本/日期 |
|---|---|---|---|
| 客户端模块清单字段为 `platform` / `inject` / `external` / `immediately`，且 `immediately` 必须是 boolean | code + doc | `@deepseek-ai/dsh-client-modules/lib/index.js`（校验函数）、`docs/subsystems/client-modules.md` | 0.2.2-rc.2 / 2026-11-12 |
| boot manifest 分 `bootstrap` / `application` 两阶段，并按依赖拓扑序排列，仅解决**代码加载顺序** | code | `dsh-client-modules/lib/index.js`（`parseBootManifest`、`graphRow`、`orderRows`） | 0.2.2-rc.2 / 2026-11-12 |
| 宿主**没有**首屏/启动画面扩展点：`boot.splash`、`bootSequence`、`startupStage`、`firstPaint` 在客户端代码中 0 命中 | measured | 全 asar 扫描（20,004 个可读文件） | 0.2.2-rc.2 / 2026-11-12 |
| 宿主文档中 `splash` / 启动画面 / 开机画面 **0 命中** | measured | `dsh/docs/**/*.md`（480 篇） | 0.2.2-rc.2 / 2026-11-12 |
| 官方客户端有 139 个 `dsh-client-*` 包；其中 53 个写 `data-plugin` 与 `data-plugin-css` | measured | asar 全量扫描 `@deepseek-ai/dsh-client-*/lib/{client,index}.js` | 0.2.2-rc.2 / 2026-11-12 |
| `data-plugin` / `data-plugin-css` / `data-composer-input` **在官方文档中 0 命中**（= 未文档化） | measured | `dsh/docs/**/*.md` 全文扫描 | 0.2.2-rc.2 / 2026-11-12 |
| 官方文档体系规模：480 篇 md；其中 `upgrade-guide/` 143 篇，按 `v<版本>/<条目>/guide.md` 组织 | measured | asar 文档路径清单 | 0.2.2-rc.2 / 2026-11-12 |
| 主题 token 命名空间为 `--dsw-alias-*` / `--dsw-specific-*`；第三方 token 白名单受 `WEB_SETTINGS_NAMESPACES` 限制 | doc | `dsh-dream-skin@10.22.0/docs/themes-spec.md`（"持久化边界"段） | 2026-11-12 |
| `--composer` 主锚点 `data-composer-input`，三级兜底策略 | doc | `dsh-dream-skin@10.22.0/docs/desktop-support.md` | 2026-11-12 |

## 生态先例

| 规范 | 类型 | 位置 | 我们借用了什么 |
|---|---|---|---|
| 工作台开发规范（2026-10-27） | doc | https://dshdesktop.com/workbench/docs/development/ | 三级强度、责任划分（宿主/插件/仅适用）、勾选自测清单、显式选择 + 安全回退 + 迁移表、版本与离线副本声明 |
| 主题包规格（themes-spec） | doc | https://cdn.jsdelivr.net/npm/dsh-dream-skin@10.22.0/docs/themes-spec.md | 契约版本化（schema v1 边界明说）、必填/推荐分级、机读判据 + 测试守住清单 |
| 桌面端兼容支持矩阵 | doc | https://cdn.jsdelivr.net/npm/dsh-dream-skin@10.22.0/docs/desktop-support.md | ⚠ 锚点风险分级与"失效时降级"的写法 |
| dsh-plugin-skills | doc | https://github.com/thatgfsj-dsh/dsh-plugin-skills | 按 DSH 版本标注适用性（`sources.md` 形式） |
| dsh-plugin-verify / DeepSeekBot 规范调研 | doc | https://github.com/qing3a/dsh-plugin-verify<br>https://github.com/botharness/deepseekbot/blob/fce475b7ba199d0444a540c5014d6143fe9d62d5/docs/research/2026-09-19-dsh-plugin-authoring-host.md | 调研型文档库的组织方式 |

## 首屏（boot）相关的实测事实

| 结论 | 类型 | 位置 | 版本/日期 |
|---|---|---|---|
| `dsh-video-skin@0.1.6` 的开机覆盖层 `.dsvs-boot` 为 `position: fixed; z-index: 2147483647` | code | `dsh-video-skin/runtime/skin.css` | 0.1.6 / 2026-11-12 |
| `dsh-boot-suite@2.16.13` 的首屏根 `#dsh-startup-root` 为 `z-index: 2147483000`；其 `splash.js` 另用 `2147483647` 作为退路 | code | `dsh-boot-suite/lib/{splash.css,splash.js}` | 2.16.13 / 2026-11-12 |
| 两者同时安装时**同时播放**：视频盖在上层，六幕动画在下面从头播，视频退场才露出中段 | measured | 本机冷启动实测 + 上述 z-index | 0.2.2-rc.2 / 2026-11-12 |
| `dsh-video-skin` 的共存让路只覆盖**局内背景层**，且只认 `data-we-wallpaper`；其文档明确"不碰开机动画" | code + doc | `dsh-video-skin/lib/config.js`（`background.mode`）、`README.zh.md` §3.7 | 0.1.6 / 2026-11-12 |
| `dsh-boot-suite` 的 `run()` 是动画唯一入口（iframe 模板 / v2 时间线 / 分幕预览都经由它） | code | `dsh-boot-suite/lib/splash.js` | 2.16.13 / 2026-11-12 |

## 生态自发的跨插件锚点（本机实测）

扫描范围：`~/.dsh/profiles/desktop/node_modules` 下 193 个已安装包（含传递依赖），
`setAttribute('data-*')`、`dataset.* =`、`getAttribute`、`querySelector([data-*])` 四种写法。

| 锚点 | 写方 | 读方 | 结论 |
|---|---|---|---|
| `data-plugin` / `data-plugin-css` | 官方 53 个 client-ui 包 | `@smalltailqwq/dsh-client-ui-skin-maid-atelier`、`dsh-pet`、`dsh-boot-suite` | **事实标准**，未文档化 → 见 `⚠` |
| `data-we-wallpaper`、`data-we-adapter` | `dsh-wallpaper-engine` | `dsh-video-skin` | 壁纸让路约定（双向只读） |
| `data-dsvs-background` | `dsh-video-skin` | 对外只读（供他人避让） | 背景归属标记 |
| `data-dsvs-boot` | `dsh-video-skin` | `dsh-boot-suite` | 首批屏交接（本仓库 boot 公约的实践） |
| `data-maid-*`（18 个） | `@smalltailqwq/...maid-atelier` | 仅自己 | 私有实现细节 |
| `data-dsh-pet-css`、`data-pw-*`、`data-ds-*` | 各自插件 | 仅自己 | 私有实现细节 |

## 如何复现本文的实测

```powershell
# 1) 读安装包内部（asar）的文件清单与内容：需要一个 asar 头解析脚本
#    参考仓库 checks/ 下的读取方式，或用 Electron 运行时：
$env:ELECTRON_RUN_AS_NODE = '1'
& "C:\Users\<user>\AppData\Local\Programs\DeepSeek Harness\DeepSeek Harness.exe" `
  --expose-internals -e "console.log(require('node:fs').readdirSync('C:/path/to/asar/dsh/node_modules/@deepseek-ai').length)"

# 2) 扫已安装插件的锚点用法
node checks/scan-anchors.mjs "C:\Users\<user>\.dsh\profiles\desktop\node_modules"

# 3) 检查某个插件是否符合公约
node checks/dsh-ui-lint.mjs "C:\Users\<user>\.dsh\profiles\desktop\node_modules\dsh-video-skin"
```
