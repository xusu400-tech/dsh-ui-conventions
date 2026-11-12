# DSH UI 插件公约（DSH UI Plugin Conventions）

> 面向**改造 DeepSeek Harness 桌面端 / 网页外观与交互**的第三方插件的一份**自愿**约定集。
> 目标：同一类插件同时安装时**互相不打架**，并且把"事实标准"从"各人猜"变成"有据可查"。
>
> **自愿遵守**：不遵守不会有任何报错，只是可能和别人冲突。遵守的收益是确定的——不与同类插件抢资源、
> 不因宿主改版莫名失效、用户不必为每个插件记一套配置。

状态：v0.1 草案 · 仅覆盖 UI 改造类插件

---

## 范围

**在范围内**：任何会改动 DSH 桌面端/网页的 DOM、样式、布局、首屏、交互的插件，例如

首屏 / 开机动画 · 局内背景与壁纸 · 主题与配色 · 侧栏 · 输入框区 · 设置页插槽 · 窗口拖拽与标题栏 ·
面板与浮层 · 通知与提示 · 消息渲染增强 · 资源与素材加载

**不在范围内**：工具类插件、与三方服务对接的插件（发布平台、模型代理、MCP 连接器、任务市场等）、
纯 Skill 包。它们不参与 UI 资源竞争，本公约不涉及。

---

## 三级强度

每一条约定都标强度，沿用 [工作台开发规范](https://dshdesktop.com/workbench/docs/development/) 的做法：

| 级别 | 含义 |
|---|---|
| **必须** | 不满足就会与同类插件冲突、或让用户看到坏掉的状态 |
| **建议** | 强烈推荐，不满足会影响体验或与其他插件的配合质量 |
| **可选** | 提升一致性的加分项 |

另有一个独立标记，用于**宿主未承诺的能力**：

| 标记 | 含义 |
|---|---|
| ⚠ | 该锚点/字段**官方未文档化或未承诺稳定**，随 DSH 版本可能变化。使用方需自备兜底，并在失效时降级而不是崩掉。 |

⚠ 条目一律在 [SOURCES.md](./SOURCES.md) 里写明"实测于哪个版本、怎么测出来的"。

---

## 命名法

生态里已有事实标准，公约**沿用而不是另起炉灶**：

| 用途 | 规则 | 说明 |
|---|---|---|
| 官方组件归属锚点 | `data-plugin="<npm 包名>"`、`data-plugin-css="<npm 包名>"` | ⚠ 官方 53 个 `dsh-client-ui-*` 包在写、第三方在读，但**未文档化**。详见 [anchors.md](./conventions/anchors.md) |
| 跨插件共享状态 | `data-dsh-<module>-*` | 例：`data-dsh-boot`、`data-dsh-background` |
| 插件私有状态 | `data-<plugin>-*` | 例：`data-maid-*`、`data-dsvs-*`。私有标记**不承诺**他人可用 |
| 事件 | `dsh:<module>-<verb>` | 例：`dsh:boot-release` |
| 全局对象 | `__DSH_<MODULE>__` | 例：`__DSH_BOOT__`（全大写模块名） |
| CSS 变量 | 只读宿主 `--dsw-*`；自定义变量用 `--<plugin>-*` | **不得**定义或覆盖 `--dsw-*` 命名空间 |
| 插件身份 | npm 包名 | `data-plugin` 的值、事件 `detail.id`、注册 id 一律用包名 |

---

## 总则（所有模块共通）

1. **必须** — 独占资源（首屏、背景层、标题栏拖拽区等）在占用前**声明**、用完**释放**；同一时刻最多一个所有者。
2. **必须** — 任何等待都有**硬上限**；任何动画都能被用户**跳过**；绝不让界面停在无内容状态。
3. **必须** — 只写自己的命名空间；**只读**别人的标记，禁改写、禁删除。
4. **建议** — 使用 ⚠ 锚点时提供三级兜底（精确选择器 → 语义兜底 → 放弃并降级），不要因一个锚点失效而整块不渲染。
5. **建议** — 提供统一的用户配置字段名（见各模块文档的"配置口径"表），让用户不必为每个插件记一套。
6. **可选** — 输出可机读的诊断标记，便于用户和作者排障。

---

## 已有模块

| 模块 | 文档 | 状态 |
|---|---|---|
| DOM 锚点（跨模块基础） | [conventions/anchors.md](./conventions/anchors.md) | 草案 |
| 首屏 / 开机动画 | [conventions/boot.md](./conventions/boot.md) | 草案（含已验证的参考实现） |

规划的模块见 [ROADMAP.md](./ROADMAP.md)（背景/壁纸、主题、侧栏、输入框、设置插槽、窗口拖拽…）。

## 案例库

真实发生过的冲突，带**确切插件版本号与实测证据**，用于日后对齐"当时是什么状态"：[cases/](./cases/)

- [首屏：两个开机动画同时播放](./cases/boot-video-skin-vs-boot-suite.md) —— `dsh-video-skin@0.1.6` × `dsh-boot-suite@2.16.13`
- [背景层：两个插件都想当背景](./cases/background-video-skin-vs-wallpaper-engine.md) —— `dsh-video-skin@0.1.6` × `dsh-wallpaper-engine`（版本未记录，已如实标注）

---

## 与其他规范的关系

本公约**不重复**官方已有文档的职责，而是补官方没写、生态又在用的那部分：

| 已有规范 | 职责 | 与本公约的关系 |
|---|---|---|
| 官方 `docs/subsystems/{slots,client-modules,client-resources,web-client}.md`、`docs/cookbook/*` | 插件机制、插槽 API、客户端模块加载 | **上位权威**。冲突时以官方文档为准 |
| 官方 `upgrade-guide/` + `engines.dsh` | 版本间破坏面 | 本公约每条标注适用版本；⚠ 条目优先对齐它 |
| [《工作台开发规范》](https://dshdesktop.com/workbench/docs/development/) | 工作台（业务面板）模块 | 借用其**三级强度、责任划分、自测清单、迁移表**的形式 |
| [`dsh-dream-skin` 主题包规格](https://cdn.jsdelivr.net/npm/dsh-dream-skin@10.22.0/docs/themes-spec.md) | 主题包格式与 token 契约 | 主题模块对齐它的 token 分级与校验思路 |
| [桌面端兼容与支持矩阵](https://cdn.jsdelivr.net/npm/dsh-dream-skin@10.22.0/docs/desktop-support.md) | 桌面端锚点风险清单 | 锚点模块与它互相引用 |

---

## 如何使用

- **插件作者**：按你涉及的模块读对应文档；每条"必须"都对应一个自测项，发布前跑一遍勾选清单。
- **用户**：用来判断"这两个插件能不能同时装"，以及冲突时该关掉哪一个开关。
- **官方/维护者**：可作为"哪些锚点值得承诺稳定"的输入——本公约的 ⚠ 条目就是候选清单。

## 如何贡献

1. 新建 `conventions/<module>.md`，复制 [templates/convention-template.md](./templates/convention-template.md)。
2. 每条结论都要有出处（代码位置、官方文档、或可复现的实测步骤），写进 [SOURCES.md](./SOURCES.md)。
3. 标注适用 DSH 版本，⚠ 条目必须写明实测日期。
4. 能自动验的写成脚本放 `checks/`，并登记到 [MACHINE-CHECKABLE.md](./MACHINE-CHECKABLE.md)。

## 许可与声明

- 本仓库是**社区约定**，不是官方规范，也不代表 DeepSeek 官方立场；与官方文档冲突时以官方为准。
- 内容以 CC BY 4.0 提供（见 [LICENSE](./LICENSE)），欢迎转载与引用。
