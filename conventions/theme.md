---
module: theme
convention: v1
dsh-verified: 0.2.2-rc.2
doc-revised: 2026-11-12
status: draft
---

# 主题 / 配色公约

> `--dsw-*` 是**宿主的 token 空间**：插件只读消费，不定义、不覆盖。插件自己的变量用 `--<plugin>-*`。
> 本模块对齐现成的[主题包规格（themes-spec）](https://cdn.jsdelivr.net/npm/dsh-dream-skin@10.22.0/docs/themes-spec.md)，
> 并补上"多主题插件共存"的部分。

## 1. 共享资源与冲突面

- **共享资源**：① 宿主语义 token（`--dsw-alias-*` / `--dsw-specific-*`）；② 主题模式（亮/暗）的判定与切换。
- **冲突面**：
  - 两个主题插件同时改同一批 token → 后写覆盖先写，用户看到"换了但没完全换"的混合态；
  - 插件覆盖 `--dsw-*` 后宿主无法再按自己的语义派生新 token（宿主新增 token 时会指向被改掉的值）。
- **不归本模块管的**：背景层（见 [background](./background.md)）、首屏配色（见 [boot](./boot.md)）。

## 2. 标记与 token

| 载体 | 谁写 | 谁读 | 说明 |
|---|---|---|---|
| `--dsw-alias-*`、`--dsw-specific-*` | **只有宿主** | 所有人 | ⚠ 官方未在文档中承诺逐个 token 的稳定性 |
| `--<plugin>-*` | 插件自己 | 插件自己 | 自己的命名空间；不得用 `--dsw-` 前缀 |
| `html[data-ds-theme-source]` | `dsh-client-ui-theme` | 所有人 | ⚠ 主题来源标记（浅/暗/跟随系统） |
| `html[data-dsh-theme]="<plugin-id>"` | 主题类插件（若接管） | 所有人 | 本公约建议：宣告"主题由谁在管"，便于让路 |

## 3. 条目

### 3.1 不得定义或覆盖 `--dsw-*`（必须）

**约定**：插件不得通过 `style.setProperty('--dsw-...')`、注入 CSS 的 `:root/body` 规则等方式定义或改写 `--dsw-*`。

**为什么**：这是宿主的语义层。覆盖它等于劫持宿主所有组件的取色途径——宿主每代新增 token 都会指向被改掉的值，
表现为"某个新界面突然不对"。实测中已有插件覆盖 `--dsw-specific-sidebar-fill` 影响整窗底色。

**怎么验**：搜代码与 CSS 里的 `--dsw-`；只应出现在**读取**位置（`var(--dsw-...)`）。规则 id：`MUST-no-dsw-namespace`。

**失效时**：无。要改外观就走"提供主题包"或改自己的变量。

### 3.2 必填 token 至少覆盖七枚（建议）

**约定**：主题包最少实现下表七枚，否则渲染不完整（对齐 themes-spec 的"必填 token"）。

| 组 | Token |
|---|---|
| 背景 | `--dsw-alias-bg-base`、`--dsw-alias-bg-layer-1` |
| 文字 | `--dsw-alias-label-primary`、`--dsw-alias-label-secondary` |
| 品牌 | `--dsw-alias-brand-primary` |
| 边框 | `--dsw-alias-border-l1`、`--dsw-alias-border-l2` |

**为什么**：只改背景不改文字，就会出现"浅底浅字"这类不可读组合。

**怎么验**：亮/暗两套下读长文本与代码块。规则 id：`SHOULD-theme-tokens`。

### 3.3 主题包要可导入可导出、且带格式版本（建议）

**约定**：主题包用固定外壳，便于分享与向后兼容：

```jsonc
{
  "format": "<your-plugin>/pack",
  "version": 1,
  "manifest": { "id": "...", "name": "...", "nameZh": "...", "author": "...", "version": "1.0.0",
                "colorScheme": "dark", "accent": "#34d399", "tokens": { "--dsw-alias-bg-base": "#04120f" } }
}
```

**为什么**：生态里已经有人这么做（themes-spec），并且明说"schema v1 的载荷边界不是缺陷，v2 才谈扩展"——
这种"把边界写清"的做法避免了别人以为丢了数据。

**怎么验**：导出后再导入，色彩一致；`version` 变更时有迁移说明。

### 3.4 颜色校验与命名（建议）

**约定**：导入时校验必填 token 与 `accent` 是否为合法颜色；`id` 用小写字母/数字/`-`，并加插件前缀避免与内置
`light`/`dark` 冲突。

**为什么**：非法颜色会让组件渲染成透明或继承色，症状隐蔽。

### 3.5 尊重宿主的主题来源（必须）

**约定**：不强行改写主题模式；若需要跟随，读 `html[data-ds-theme-source]` 或宿主主题服务。

**为什么**：用户切换亮/暗时若被插件改回去，观感是"设置不生效"。

### 3.6 ⚠ 派生 token 不要"补"（⚠）

**约定**：宿主新增的 token 若其声明是 `var(--dsw-...)` 指向已存在的 token，属**宿主自己派生**，插件不应再加规则；
只有宿主写成**颜色字面量**时才是真缺口。

**为什么**：themes-spec 用机读判据（`host-gap-dispositions.cjs` + 测试）维护这件事，并特意写下三条归类"阻止下一轮
把它们当缺口补一遍"。人工记忆维护清单必然出错。

**怎么验**：规则 id：`WARN-undocumented-anchor`（warn）。建议在插件仓库放一个"宿主 token 普查"脚本。

### 3.7 第三方设置命名空间不可用时用 `localStorage`（⚠）

**约定**：第三方插件的设置**不要**指望走宿主 settings 线路——浏览器侧只暴露白名单命名空间
（`WEB_SETTINGS_NAMESPACES`），未在白名单的命名空间会答 `settings-not-exposed`。持久化用 `localStorage`
（带自己的前缀键名）或插件自己的配置文件。

**为什么**：实测结论（themes-spec"持久化边界"段）。按错路径写会得到"设置不保存"的诡异现象。

**怎么验**：改设置 → 刷新 → 仍在；规则 id：无（无法静态判定）。

## 4. 配置口径

| 字段 | 默认 | 含义 |
|---|---|---|
| `theme.mode` | `"ask"` | `ask` 询问 / `auto` 跟随宿主 / `off` 不接管 |
| `theme.pack` | 内置 | 当前主题包 id |

## 5. 责任划分

| 事项 | 宿主负责 | 插件负责 | 仅使用该能力时适用 |
|---|---|---|---|
| 提供并稳定 `--dsw-*` token | ✅（未文档化，⚠） | | |
| 只读 token、不覆盖 | | ✅ | |
| 可读性（对比度） | | ✅ | |
| 主题包的导入导出与版本 | | ✅ | ✅ |
| 主题模式跟随 | ✅ | ✅（不得强行改写） | |

## 6. 参考实现：主题包校验

```js
var REQUIRED_TOKENS = [
  '--dsw-alias-bg-base', '--dsw-alias-bg-layer-1',
  '--dsw-alias-label-primary', '--dsw-alias-label-secondary',
  '--dsw-alias-brand-primary',
  '--dsw-alias-border-l1', '--dsw-alias-border-l2',
]
var COLOR_RE = /^(#[0-9a-f]{3}|#[0-9a-f]{6}|rgb\(|rgba\(|hsl\(|hsla\()/i

/** 校验主题包是否可导入；返回 { ok, missing, badColors }。 */
function validateThemePack(pack) {
  var missing = [], badColors = []
  var tokens = (pack && pack.manifest && pack.manifest.tokens) || {}
  for (var i = 0; i < REQUIRED_TOKENS.length; i++) {
    var t = REQUIRED_TOKENS[i]
    if (!(t in tokens)) { missing.push(t); continue }
    if (!COLOR_RE.test(String(tokens[t]))) badColors.push(t)
  }
  var accent = pack && pack.manifest && pack.manifest.accent
  if (accent && !COLOR_RE.test(String(accent))) badColors.push('accent')
  return { ok: missing.length === 0 && badColors.length === 0, missing: missing, badColors: badColors }
}
```

## 7. 自测清单

- [ ] 代码与 CSS 中没有对 `--dsw-*` 的写入（只有 `var(--dsw-...)` 读取）
- [ ] 自定义变量都用 `--<plugin>-*` 前缀
- [ ] 亮色/暗色两套下：正文、次要文字、代码块、边框、按钮都可读
- [ ] 切换宿主主题后，插件外观跟随且不被改回
- [ ] 主题包导出→导入结果一致；缺 token 时给出明确提示而不是静默渲染错乱
- [ ] 设置改完刷新后仍生效
- [ ] 宿主升级后重跑一次 token 普查，不把派生 token 当缺口补

## 8. 迁移与回退

- **从"直接覆盖 `--dsw-*`"迁移**：改为在自建容器内覆盖自己的变量 + 只读宿主 token；过渡期可用
  `:where()` 降低优先级并只覆盖允许的少数几枚。
- **回退**：保留"恢复宿主默认"的一键动作（移除自己的覆盖层）。

## 9. 交叉引用

- [themes-spec](https://cdn.jsdelivr.net/npm/dsh-dream-skin@10.22.0/docs/themes-spec.md) — 主题包格式与 token 分级（上位参考）
- [desktop-support.md](https://cdn.jsdelivr.net/npm/dsh-dream-skin@10.22.0/docs/desktop-support.md) — token 契约与锚点风险
- [anchors.md](./anchors.md)、[background.md](./background.md)
