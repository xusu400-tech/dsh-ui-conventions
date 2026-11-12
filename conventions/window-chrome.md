---
module: window-chrome
convention: v1
dsh-verified: 0.2.2-rc.2
doc-revised: 2026-11-12
status: draft
---

# 窗口外观 / 拖拽公约

> 标题栏留白、窗口拖拽区、系统控件避让是**宿主与桌面壳共同管理的区域**。插件能读、能请求让位，
> 但**不得自建第二套窗口控件**，也不能指望用 z-index 盖住系统层。

## 1. 共享资源与冲突面

- **共享资源**：顶部留白与拖拽区（宿主通常给一个 clearance 变量，约 48px）、窗口最小化/关闭等系统控件、
  以及"哪块能拖动窗口"。
- **冲突面**：
  - 插件在顶部放交互元素却没排除拖拽 → 点击变成拖窗口，按钮点不动；
  - 插件为 macOS 非全屏状态预留了控件行，而 Windows 用独立标题栏 → 出现双重留白；
  - 想用 `z-index` 盖住 Electron 的 `titleBarOverlay` —— **盖不住**（系统层在页面之上，实测注释见 `dsh-boot-suite`）。
- **已有机制**（出处见 [SOURCES](../SOURCES.md)）：
  - 工作台规范定义了拖拽协议：宿主把顶部区域的非交互部分设为拖动区，并按实际控件矩形排除按钮/输入/菜单/iframe
    与自定义 `data-dsh-no-drag` 区域；宿主内部标记 `data-dsh-compact-toolbar`、`data-dsh-compact-valid`
    **不得由插件设置**。
  - 顶部 clearance 通过 CSS 变量暴露（工作台规范记为 `--dsh-frame-top-clearance`，约 48px）。

## 2. 标记

| 载体 | 谁写 | 谁读 | 说明 |
|---|---|---|---|
| `data-dsh-no-drag` | 插件（在自己需要点击的区域） | 宿主 | 声明"这块不是拖拽区" |
| `data-dsh-compact-toolbar` / `data-dsh-compact-valid` | **只有宿主** | 宿主 | 插件不得写 |
| `--dsh-frame-top-clearance` | 宿主 | 所有人 | ⚠ 顶部留白高度；缺失时自备兜底值 |
| `data-dsh-chrome="<plugin-id>"` | 插件 | 所有人 | 可选：宣告顶部装饰层归属 |

## 3. 条目

### 3.1 不得自建第二套窗口控件（必须）

**约定**：不复制最小化/最大化/关闭按钮，不替换标题栏。

**为什么**：系统控件行为（双击最大化、右键系统菜单、全屏切换）由壳管理；自建版本必然缺行为，并会与壳的
避让逻辑打架。

### 3.2 交互区域必须声明非拖拽（必须）

**约定**：插件放在顶部留白区里的可点击元素（按钮、输入、菜单、自定义交互块）加 `data-dsh-no-drag`；
自定义展开菜单与弹层同样加。

**为什么**：宿主只按"标准交互 role"排除拖拽，自定义元素的 role 往往识别不出来，结果点击变成拖窗口。

**怎么验**：在顶部装饰里点按钮、开菜单、输入文字：全部正常且不触发窗口拖动。

### 3.3 不自留系统控件行（必须）

**约定**：不为系统控件预留独立行——那由宿主负责。只使用宿主暴露的 clearance 变量；缺失时用兜底值，
但不要在已有 clearance 的基础上再叠加。

**为什么**：工作台规范的实测结论是"默认模式仅在 macOS 非全屏且侧栏收起时预留独立系统控件行"，
插件再留一次就是双重留白。

### 3.4 不得试图用 z-index 覆盖系统层（必须）

**约定**：不把关键 UI 放在需要"盖住标题栏/系统控件"的位置；`titleBarOverlay` 之上的区域不属于页面。

**为什么**：Electron 的 `titleBarOverlay` 画在页面之上，任何 z-index 都盖不住（实测注释）。放在那里的内容
会被系统层遮住，用户看到"按钮不见了"。

### 3.5 全屏 / 非全屏、macOS / Windows 差异要分别验（建议）

**约定**：至少验四种组合：{全屏, 非全屏} × {macOS 风格标题栏, Windows 独立标题栏}。

**为什么**：留白与控件行在这些组合下不同，只在一种组合下测过是最常见的事故来源。

## 4. 配置口径

| 字段 | 默认 | 含义 |
|---|---|---|
| `chrome.decorate` | `true` | 是否在顶部加装饰 |
| `chrome.headerLayout` | `"default"` | 工作台类插件：`default` / `compact`（若宿主支持） |

## 5. 责任划分

| 事项 | 宿主负责 | 插件负责 | 仅使用该能力时适用 |
|---|---|---|---|
| 系统控件与拖拽行为 | ✅ | | |
| 计算并暴露顶部 clearance | ✅（未文档化，⚠） | | |
| 声明 `data-dsh-no-drag` | | ✅ | ✅ |
| 不自建控件、不自留控件行 | | ✅ | ✅ |
| 四种组合下的回归 | | ✅ | ✅ |

## 6. 参考实现：安全地放在顶部留白区

```js
/** 读取宿主顶部留白；缺失时给兜底值，绝不叠加。 */
function topClearance() {
  var cs = getComputedStyle(document.documentElement)
  var v = cs.getPropertyValue('--dsh-frame-top-clearance').trim()   /* ⚠ 未文档化 */
  var n = parseFloat(v)
  return isFinite(n) && n > 0 ? n : 48
}

/** 在顶部放可交互元素：必须标 no-drag，否则点击会变成拖窗口。 */
function mountHeaderControl(el) {
  el.setAttribute('data-dsh-no-drag', '')            /* 宿主据此排除拖拽 */
  el.style.top = topClearance() + 'px'
  return el
}
```

## 7. 自测清单

- [ ] 顶部装饰里的按钮、输入、菜单都能点，且不拖动窗口
- [ ] 空白处拖动可以移动窗口
- [ ] 全屏 / 非全屏：无双重留白、无控件遮挡
- [ ] macOS 标题栏风格 / Windows 独立标题栏：分别验过
- [ ] 侧栏展开与收起：留白正确
- [ ] 没有在系统层之上放关键 UI
- [ ] `data-dsh-compact-toolbar` / `data-dsh-compact-valid` 没有被自己写过

## 8. 迁移与回退

- 从"自己留控件行"迁移到"只读 clearance"：先并存观测，确认无双重留白后移除自留部分。
- 回退：提供 `chrome.decorate:false`。

## 9. 交叉引用

- [工作台开发规范](https://dshdesktop.com/workbench/docs/development/) — 拖拽协议与 `data-dsh-no-drag` 的上位来源
- [sidebar.md](./sidebar.md)、[overlay.md](./overlay.md)
