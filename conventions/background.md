---
module: background
convention: v1
dsh-verified: 0.2.2-rc.2
doc-revised: 2026-11-12
status: draft
---

# 局内背景 / 壁纸公约

> 内容层背景（`z-index: -1` 那一层）与页面表面半透明化是**独占资源**：同一时刻只应有一个插件管它。
> 本模块规定"怎么让路、怎么宣告自己在管"，让多个壁纸/皮肤插件共存而不是互相盖住。

## 1. 共享资源与冲突面

- **共享资源**：① 垫在内容之下的背景层（图片/视频/渐变）；② 页面表面的半透明化（`--dsw-alias-*` 的一部分）。
- **实测过的冲突**：`dsh-video-skin` 与 `dsh-wallpaper-engine` 双方都想管这一层——`#dsvs-backdrop` 会盖住对方的壁纸，
  对方也看不到自己的画。两者的作者最终约定用**只读标记**互相避让（video-skin README §3.7）。
- **与首屏的区别**：首屏是**全窗覆盖**（见 [boot](./boot.md)），背景层是**垫在内容之下**。两者可以同时存在，
  不构成冲突。
- **不归本模块管的**：首屏覆盖层、token 取值（见 [theme](./theme.md)）。

## 2. 标记与事件

| 载体 | 谁写 | 谁读 | 说明 |
|---|---|---|---|
| `data-we-wallpaper="on"` | `dsh-wallpaper-engine`（历史约定） | 所有人 | ⚠ 第三方私有标记，实测被 video-skin 读取 |
| `data-dsvs-background="on"` | `dsh-video-skin` | 所有人 | ⚠ 同上 |
| `data-dsh-background="<plugin-id>"` | **占用者** | 所有人 | 本公约要求的统一形态；值 = 占用的插件 id，让路时移除 |
| 事件 `dsh:background-claim` / `dsh:background-release` | 占用者 | 所有人 | `detail: { id, mode }` |

## 3. 条目

### 3.1 默认让路（必须）

**约定**：默认模式（`auto`）下，只要检测到别的插件正在管背景（任一共享标记存在且值不是自己），
就**不建背景层、不挂自己的标记**，让对方的画面透出来；对方撤掉后自动接回。

**为什么**：这是实测中最有效的共存策略——两个"坚持要当背景"的插件必然有一个被压暗/被盖住。
让路让用户至少能看到一个完整的画面。

**怎么验**：先启用 A 的背景、再启用 B 的背景，B 不应把 A 盖住；关掉 A 后 B 应在下一帧接回。

### 3.2 只写自己的标记，只读别人的（必须）

**约定**：不得写、不得删他人标记。写 `data-dsh-background="<自己的 id>"` 与自身私有标记。

**为什么**：互相写对方标记会导致"谁在管"永远算不清，出现双方都让路（都没背景）的空白态。

### 3.3 背景层必须在内容之下（必须）

**约定**：背景层用**负** z-index（如 `-1`，多层用 `-2`/`-1`），`position: fixed; inset: 0`，且 `pointer-events: none`。

**为什么**：正 z-index 会盖住对话内容与控件；`pointer-events` 不关会让整个界面点不动。

**怎么验**：界面可正常滚动、点击、选中文字。

### 3.4 半透明化必须有可读性下限（必须）

**约定**：调整表面 token 时保留正文可读性——正文与背景的对比度不得低于无障碍下限；面板/弹层**建议保留不透明**
（实测做法：`--dsw-alias-bg-overlay`、菜单面、文档预览、遮罩这几类刻意不动）。

**为什么**：透明度过低会让长文本、代码块、弹层内容不可读；这是"好看"与"能用"的取舍，默认必须站"能用"。

**怎么验**：亮色/暗色主题下各读一段长文本与一段代码；弹层里读文字不费力。

### 3.5 背景视频要等界面就绪再加载（建议）

**约定**：视频背景延迟加载（例如界面就绪后 `delayMs` ≈ 1200ms），把启动带宽留给界面。

**为什么**：首屏阶段抢带宽会拖慢界面出现，用户感受是"启动变慢"。

**怎么验**：断网/限速下启动，界面应先出现，背景后到。

### 3.6 提供 `mode` 三态（建议）

**约定**：`background.mode ∈ { auto, own, off }`：`auto` 让路、`own` 始终接管、`off` 不参与。

**为什么**：用户有时就是想指定某一个插件当背景。默认让路 + 可强制接管，比"谁先加载谁赢"可预期。

## 4. 配置口径

| 字段 | 默认 | 含义 |
|---|---|---|
| `background.enabled` | `true` | 是否启用背景层 |
| `background.mode` | `"auto"` | `auto` 让路 / `own` 始终接管 / `off` 不参与 |
| `background.file` | 插件自带 | 背景素材路径（包内相对或绝对） |
| `background.veil` | 依插件 | 纱/遮罩浓度 |
| `background.surface` | 依插件 | 页面表面不透明度 |
| `background.delayMs` | `1200` | 界面就绪后多久开始加载背景 |

## 5. 责任划分

| 事项 | 宿主负责 | 插件负责 | 仅使用该能力时适用 |
|---|---|---|---|
| 保证内容可读性与控件可用 | | ✅ | |
| 让路 / 接回的判定 | | ✅ | |
| 暴露只读占用标记 | | ✅ | |
| 用户选择谁当背景 | | ✅（提供 mode 开关） | ✅ |

## 6. 参考实现：让路判定

```js
/** 是否有别的插件正在管背景（true = 我应让路）。 */
function shouldYieldBackground(selfId) {
  var marks = [
    ['data-dsh-background', selfId],      /* 公约形态：值即占用者 id */
    ['data-we-wallpaper', null],          /* wallpaper-engine：存在即"有壁纸在台上" */
    ['data-dsvs-background', null],       /* video-skin：存在即"它真的在管背景" */
  ]
  for (var i = 0; i < marks.length; i++) {
    var attr = marks[i][0], own = marks[i][1]
    var v = document.documentElement.getAttribute(attr)
    if (v == null || v === '' || v === 'off' || v === 'false' || v === '0') continue
    if (own && v === own) continue
    return true
  }
  return false
}
```

## 7. 自测清单

- [ ] 只装我一个：背景正常显示，无额外延迟（除 `delayMs`）
- [ ] 装了另一个壁纸插件：我让路，画面是对方的；对方关掉后我自动接回
- [ ] 切到 `own`：我接管，对方画面被盖住（这是预期，不是 bug）
- [ ] 切到 `off`：我完全不建层、不写标记
- [ ] 亮色/暗色主题：正文、代码块、弹层内容都可读
- [ ] 界面可滚动、可点击、可选中文字（背景层不吃事件）
- [ ] 断网：包内素材仍能显示
- [ ] 窄窗口/侧栏展开收起：背景不溢出、不挤压内容

## 8. 迁移与回退

- 从私有标记迁移：**双写** `data-dsvs-background` / `data-we-wallpaper` 与本公约的 `data-dsh-background`，
  确认下游都切换后再撤私有标记。
- 回退：`mode: own` 就是"退回抢背景"的行为，用户可自行选择。

## 9. 交叉引用

- [anchors.md](./anchors.md) — 命名空间与三级兜底
- [boot.md](./boot.md) — 首屏（不同层，可共存）
- [theme.md](./theme.md) — 表面 token 的取值边界
