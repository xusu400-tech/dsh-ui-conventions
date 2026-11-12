---
module: sidebar
convention: v1
dsh-verified: 0.2.2-rc.2
doc-revised: 2026-11-12
status: draft
---

# 侧栏公约

> 侧栏是**宿主的结构性区域**：插件可以装饰、可以响应它的状态，但**不得改写它的状态**、不得遮挡它的公共入口。

## 1. 共享资源与冲突面

- **共享资源**：侧栏的宽度/折叠态、滚动容器、条目行（会话、工作区、分组）、底部区域。
- **冲突面**：
  - 装饰层（蕾丝、贴纸、宠物）吃掉了点击，导致会话点不开；
  - 插件自行"折叠侧栏"或改宽度，与宿主的折叠逻辑打架，出现双重留白/错位；
  - 遮挡"工作台市场 / 工作台管理"等宿主保留入口。
- **实测锚点**（0.2.2-rc.2，asar 扫描，⚠ 全部未文档化）：
  `data-sidebar-right-session`、`data-sidebar-right-occurrence`、`data-sidebar-right-flash`（`dsh-client-ui-sidebar-right`）、
  `data-sidebar-browser-frame`、`data-clipped` / `data-scrolled`（`dsh-client-ui-workspace`）。
- **不归本模块管的**：侧栏配色（见 [theme](./theme.md)）。

## 2. 标记

| 载体 | 谁写 | 谁读 | 说明 |
|---|---|---|---|
| `data-sidebar-*`（宿主） | 宿主 | 所有人（只读） | ⚠ 未文档化 |
| `data-dsh-sidebar="<plugin-id>"` | 装饰类插件 | 所有人 | 可选：宣告"这一层是我加的" |
| `data-<plugin>-*` | 插件自己 | 插件自己 | 私有状态（如展开态缓存） |

## 3. 条目

### 3.1 不得改写宿主侧栏状态（必须）

**约定**：只**读**侧栏折叠/宽度状态，不写。需要"折叠时换样式"就响应状态，而不是替用户折叠。

**为什么**：宿主的折叠逻辑与布局留白是联动计算的；插件插手会产生双重留白、控件被裁切，且与用户预期相反。
参考工作台规范的做法：**侧栏状态由用户控制并在模式间保持**，插件不得私自改写宿主状态。

**怎么验**：操作插件的功能时，侧栏折叠态不应变化。

### 3.2 装饰层不得吃事件（必须）

**约定**：铺在侧栏上的装饰/氛围层 `pointer-events: none`；确需交互的元素单独开启并限定范围。

**为什么**：一个透明的全区域层会让会话列表、工作区、分组全部点不动——这是最容易发生、也最容易被误报为
"宿主 bug"的故障。

**怎么验**：装饰开启状态下，逐个点击会话/工作区/滚动/右键，全部正常。

### 3.3 不得遮挡宿主保留入口（必须）

**约定**：市场、工作台切换、管理、设置等公共入口必须可见可用；装饰元素不与它们重叠。

**怎么验**：侧栏展开/收起两种状态下逐个点开公共入口。

### 3.4 按容器宽度响应，而不是窗口宽度（建议）

**约定**：用容器查询或测量侧栏容器宽度决定布局，不用整窗媒体查询。

**为什么**：侧栏宽度随折叠、嵌入模式、窗口尺寸独立变化，"窗口很宽但侧栏很窄"是常态。用媒体查询必然在某个
组合下失效（工作台规范对此有同样的要求）。

**怎么验**：窗口拉宽但折叠侧栏 → 装饰/紧凑样式应仍正确。

### 3.5 锚点使用必须三级兜底（必须）

**约定**：`data-sidebar-*` 等锚点读不到时，退回语义查询（滚动容器内的第一条/最后一条等），再不行就**放弃装饰**
而不是报错。

**为什么**：这些锚点未文档化（见 SOURCES），宿主改版即可能失效。

**怎么验**：把锚点选择器改成不存在的值，插件应降级为"不装饰"而不是抛异常或错位。

## 4. 配置口径

| 字段 | 默认 | 含义 |
|---|---|---|
| `sidebar.decorate` | `true` | 是否在侧栏加装饰 |
| `sidebar.compact` | `"auto"` | `auto` 跟随容器宽度 / `on` / `off` |

## 5. 责任划分

| 事项 | 宿主负责 | 插件负责 | 仅使用该能力时适用 |
|---|---|---|---|
| 侧栏折叠状态与公共入口 | ✅ | | |
| 装饰层不吃事件 | | ✅ | ✅ |
| 不遮挡公共入口 | | ✅ | ✅ |
| 锚点兜底与降级 | | ✅ | ✅ |

## 6. 参考实现：只读侧栏状态

```js
/**
 * 读取宿主侧栏状态（只读）。任何写操作都属于违反 3.1。
 * @returns {{collapsed: boolean|null, width: number|null, via: string}}
 */
function readSidebarState() {
  var root = document.documentElement
  var collapsed = null
  var v = root.getAttribute('data-sidebar-collapsed')   /* ⚠ 未文档化 */
  if (v === 'true' || v === '1') collapsed = true
  else if (v === 'false' || v === '0') collapsed = false
  var el = document.querySelector('[data-plugin="dsh-client-ui-sidebar"]') ||
           document.querySelector('[data-sidebar-right-session]')?.closest('aside') || null
  var width = el ? Math.round(el.getBoundingClientRect().width) : null
  return { collapsed: collapsed, width: width, via: el ? 'anchor' : 'none' }
}
```

## 7. 自测清单

- [ ] 侧栏展开/收起：装饰正确，无双重留白、无控件裁切
- [ ] 装饰开启时：会话/工作区/分组可点、可滚动、可右键
- [ ] 公共入口（市场、切换、管理、设置）在两种状态下都可见可用
- [ ] 窗口拉宽但侧栏折叠：紧凑样式仍正确
- [ ] 中英文长标题、长数字、长文件名：不单字竖排、不溢出
- [ ] 把宿主锚点改成不存在的值：装饰降级，不报错、不错位
- [ ] 宿主升级一个小版本后回归锚点失效路径

## 8. 迁移与回退

- 从"按类名定位"迁移到"锚点 + 语义兜底"；过渡期两条路径并存，锚点路径优先。
- 回退：提供 `sidebar.decorate: false` 一键关闭装饰，用户可自救。

## 9. 交叉引用

- [anchors.md](./anchors.md) — 锚点读法与规范
- [window-chrome.md](./window-chrome.md) — 顶部留白与拖拽区（与侧栏交界处）
- [overlay.md](./overlay.md) — 侧栏内浮层
