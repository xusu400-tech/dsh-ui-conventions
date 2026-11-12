---
module: anchors
convention: v1
dsh-verified: 0.2.2-rc.2
doc-revised: 2026-11-12
status: draft
---

# DOM 锚点公约

> 第三方 UI 插件靠 DOM 找地方（侧栏、输入框、消息、设置页），但宿主**没有承诺过任何锚点**。
> 本模块规定：谁可以写哪些标记、怎么读别人的标记、读不到时怎么办。

## 1. 共享资源与冲突面

- **共享资源**：全站 DOM 结构本身。
- **实测过的冲突**：
  - 多个皮肤插件都去挂 `html`/`body` 上的标记与全局样式，互相覆盖（`data-we-*` 与 `data-dsvs-*` 各自发明，见 [SOURCES](../SOURCES.md)）。
  - 官方 53 个客户端包写 `data-plugin` / `data-plugin-css`，第三方已经在**读**它们做锚点，**但官方文档中 0 命中**——这是当前生态最大的隐性赌注。
- **不归本模块管的**：首屏独占（见 [boot](./boot.md)）、背景层归属（见 [background](./background.md)）、token 取值（见 [theme](./theme.md)）。

## 2. 三类标记，权限不同

| 类别 | 形式 | 谁能写 | 谁能读 |
|---|---|---|---|
| **宿主发布** | `data-plugin`、`data-plugin-css`、`data-chat-*`、`data-sidebar-*`、`data-ds-theme-source` 等 | **只有宿主** | 所有人（只读） |
| **跨插件共享** | `data-dsh-<module>[-<key>]` | 该模块的**当前占用者** | 所有人（只读） |
| **插件私有** | `data-<plugin>-*` | 只有该插件 | 通常只有自己 |

**宿主内部标记（禁止任何插件写）**：data-dsh-compact-toolbar、data-dsh-compact-valid。data-plugin / data-plugin-css 是**所有权标记**，可在自己的节点上写一次。

## 3. 条目

### 3.1 宿主标记只读；所有权标记只能写自己的（必须）

**约定**：把宿主发布的 `data-*` 当作**只读**输入。具体分两类：

| 类别 | 标记 | 允许的操作 |
|---|---|---|
| 宿主内部 | `data-dsh-compact-toolbar`、`data-dsh-compact-valid` | **任何写入、删除都不允许** |
| 所有权标记 | `data-plugin`、`data-plugin-css` | 只允许在**你自己创建的节点/样式表**上写一次（值为自己的包名）；**不得**改写或删除宿主/他人节点上的值 |

**为什么**：宿主内部标记是渲染管线的一部分，改写会让宿主或其他插件把元素错认成别的组件（症状是"某块 UI 突然错位"，极难归因）；而 `data-plugin` 是生态唯一的归属声明机制——官方 53 个包都写它，第三方也在读它，堵死它等于让所有插件退回"猜类名"。

**怎么验**：搜 `setAttribute('data-plugin-css'`、`removeAttribute('data-plugin'`、`dataset.pluginCss =`；应为 0 处。规则 id：`MUST-no-host-marker-write`。

**失效时**：不需要降级——这是纯约束。

### 3.2 用锚点必须三级兜底（必须）

**约定**：定位任何宿主 UI 时，按 **精确锚点 → 语义兜底 → 放弃并降级** 三级写，不允许只有一条脆弱的 CSS 路径。

```js
const el =
  document.querySelector('[data-plugin="' + pkg + '"] .surface') ??   // 1. 精确锚点
  document.querySelector('[data-composer-input]')?.closest('.surface') ?? // 2. 语义锚点
  null                                                               // 3. 放弃
if (!el) return downgrade('composer-anchor-missing')                  // 降级，不崩
```

**为什么**：宿主每代都会调整 DOM。三级兜底让"没找到"变成可见的降级，而不是静默错位或抛异常（实测案例见 `dsh-dream-skin` 的 `COMPOSER_ANCHOR_SELECTOR` 三级兜底）。

**怎么验**：把每处选择器改成明显不存在的值，插件应降级而不是白屏。规则 id：`WARN-undocumented-anchor`（对 ⚠ 锚点）。

**失效时**：降级路径必须保留。

### 3.3 为自己的根元素标 `data-plugin`（建议）

**约定**：插件插入的常驻根元素（覆盖层、面板、挂件）写 `data-plugin="<npm 包名>"`，便于宿主与别的插件识别归属、也便于用户排障时一眼看出是谁的 DOM。

**为什么**：官方 53 个客户端包都这么做，生态已按这个约定在读；不标的话别人只能靠类名猜，猜错就会误伤。

**怎么验**：DevTools 里检查你插入的根节点是否有该属性。规则 id：`SHOULD-plugin-anchor`。

**失效时**：即使官方不承诺，标它也没有代价。

### 3.4 私有标记用自己的前缀（建议）

**约定**：插件内部状态用 `data-<plugin>-*`（例如 `data-maid-*`、`data-dsvs-*`），不要占用裸名（`data-phase`、`data-row`、`data-tab` 这类）。

**为什么**：裸名极易与宿主或其他插件撞车；一旦撞车，双方都会读到错的元素。实测中 `data-phase`、`data-tab`、`data-row` 都已被不同来源使用。

**怎么验**：搜自己代码里所有 `data-*` 写入，逐个确认前缀属于自己。规则 id：`MUST-namespace-own`（占用**已知他人**前缀时升级为必须）。

**失效时**：无。

### 3.5 跨插件协作走 `data-dsh-<module>-*`（必须）

**约定**：需要让别的插件知道自己状态时（首屏在播、背景归我管、正在裁剪…），用 `data-dsh-<module>` 这一族，配合 `dsh:<module>-<verb>` 事件。

**为什么**：`data-we-wallpaper`、`data-dsvs-background` 这类私有约定已经证明"点对点"能解决问题，但也证明了它的上限——每个插件只认识自己适配过的那个，N 个插件就是 O(N²) 条约定。

**怎么验**：见各模块文档（如 [boot](./boot.md) 的认领/释放）。

**失效时**：模块文档里定义。

### 3.6 ⚠ 未文档化锚点必须在插件 README 里登记（⚠）

**约定**：凡依赖下表中标 ⚠ 的锚点，在插件 README 的"已知限制"里列出：用了哪个锚点、实测于哪个版本、失效时的表现。

**为什么**：宿主改版时，用户和排障者需要知道"这是插件的问题还是宿主改了"。`dsh-dream-skin` 的桌面支持矩阵就是这么做的，并且明确点出非官方壳的类名是"唯一真实赌注"。

**怎么验**：README 有对应段落。规则 id：`WARN-undocumented-anchor`（warn，不阻塞）。

**失效时**：按 3.2 降级。

### 3.7 不要按类名或 DOM 结构定位（必须）

**约定**：定位宿主元素时不用 `.someClassName`、`:nth-child(3)`、`div > div > span` 这类结构性选择器。

**为什么**：类名通常是构建哈希或内部命名，结构会随渲染框架调整。实测中有人只能靠非官方壳的 `.dshDesktopSidebarSurface` 定位，作者自己标注为"壳改版即失配"。

**怎么验**：搜选择器字符串里的 `.`、`:nth-`、` > `；每处都应有兜底或明确的风险注释。

**失效时**：改用语义锚点。

## 4. 锚点清单（实测）

**宿主发布（只读）** —— 本机 asar 全量扫描 139 个 `dsh-client-*` 包所得，2026-11-12 / 0.2.2-rc.2：

| 锚点 | 写方数量 | 稳定度 | 用途 | 建议兜底 |
|---|---|---|---|---|
| `data-plugin` | 53 包 | ⚠ 未文档化但**广泛** | 组件归属（值 = npm 包名） | 语义兜底：区域 role / 文本 |
| `data-plugin-css` | 53 包 | ⚠ 同上 | 样式表归属 | 一般不需要定位 |
| `data-ds-theme-source` | `dsh-client-ui-theme` | ⚠ | 当前主题来源 | 读 `html` 上的主题 class 兜底 |
| `data-chat-anchor-key`、`data-chat-node-key`、`data-chat-group-key` | `dsh-client-ui-chat` | ⚠ | 消息/分组锚点 | 用消息顺序兜底 |
| `data-sidebar-right-*` | `dsh-client-ui-sidebar-right` | ⚠ | 右侧栏容器 | 侧栏容器的范围查询 |
| `data-composer-input` | 未在官方代码中确认（来源：第三方文档） | ⚠⚠ | 输入框主锚 | 三级兜底（`textarea` / `contenteditable` / 放弃） |

**跨插件共享**：

| 锚点 | 写方 | 读方（实测） | 模块 |
|---|---|---|---|
| `data-dsh-boot` | 首屏占用者 | 等待中的首屏插件 | [boot](./boot.md) |
| `data-we-wallpaper` | `dsh-wallpaper-engine` | `dsh-video-skin` | [background](./background.md) |
| `data-dsvs-background` | `dsh-video-skin` | 任意（对外只读） | [background](./background.md) |

**插件私有（举例，不承诺他人可用）**：`data-maid-*`（18 个）、`data-dsh-pet-css`、`data-pw-*`、`data-ds-*`。

## 5. 配置口径

本模块不引入配置项。锚点相关的开关应由各插件自己的配置控制（如 `anchor.strict`）。

## 6. 责任划分

| 事项 | 宿主负责 | 插件负责 | 仅使用该能力时适用 |
|---|---|---|---|
| 发布并稳定 `data-plugin` 等锚点 | ✅（未承诺，⚠） | | |
| 只读锚点、不改写 | | ✅ | |
| 三级兜底与降级 | | ✅ | |
| 在 README 登记 ⚠ 依赖 | | ✅ | ✅ |
| 跨插件共享标记的语义 | | ✅ | ✅（参与协作时） |

## 7. 参考实现：锚点解析与降级

```js
/**
 * 按"精确锚点 → 语义兜底 → 放弃"解析宿主元素。
 * @param {string} pkg 宿主包名，用于 data-plugin 精确匹配
 * @param {string[]} semantics 语义兜底选择器，按优先级排列
 * @returns {{el: Element|null, via: 'anchor'|'fallback'|'none'}}
 */
function resolveHostAnchor(pkg, semantics) {
  var exact = null
  try { exact = document.querySelector('[data-plugin="' + pkg + '"]') } catch (e) { exact = null }
  if (exact) return { el: exact, via: 'anchor' }
  for (var i = 0; i < semantics.length; i++) {
    var hit = null
    try { hit = document.querySelector(semantics[i]) } catch (e) { hit = null }
    if (hit) return { el: hit, via: 'fallback' }
  }
  return { el: null, via: 'none' }   /* 调用方必须处理 none：降级而不是崩 */
}
```

## 8. 自测清单

- [ ] 代码里没有 `setAttribute('data-plugin' | 'data-plugin-css' | 'data-dsh-compact-*')`
- [ ] 所有 `data-*` 写入都在自己前缀或 `data-dsh-<module>-*` 下
- [ ] 每处宿主锚点都有语义兜底；把锚点改成不存在的值后，插件降级而不白屏
- [ ] 插入的根元素带 `data-plugin="<包名>"`（建议项）
- [ ] 没有 `:nth-child` / 深层 `>` 结构选择器
- [ ] README 的"已知限制"列出了所有 ⚠ 锚点及其实测版本
- [ ] 宿主升级后（至少跳一个小版本）回归过锚点失效路径

## 9. 迁移与回退

- **从"猜类名"迁移**：先加 `data-plugin` 精确路径 + 现有类名作兜底 → 观察一个版本 → 去掉类名路径。
- **从私有标记迁移到 `data-dsh-*`**：双写一段时间（旧标记保留），确认下游切换后再撤。
- **回退**：任何锚点改动都保留 `via` 信息（`anchor` / `fallback` / `none`），出问题能立刻看出走的是哪条路。

## 10. 交叉引用

- [boot.md](./boot.md) — `data-dsh-boot` 的语义
- [background.md](./background.md) — `data-we-wallpaper` / `data-dsvs-background`
- 官方：`docs/subsystems/client-modules.md`、`docs/subsystems/slots.md`
