---
module: composer
convention: v1
dsh-verified: 0.2.2-rc.2
doc-revised: 2026-11-12
status: draft
---

# 输入框区公约

> 底部输入区（composer）承载用户输入与发送，是**高频交互**区域：装饰可以，**不得改变输入行为**、不得吞按键。

## 1. 共享资源与冲突面

- **共享资源**：输入框几何与位置、按键流（Enter/Shift+Enter/快捷键）、发送按钮区域、附件与工具栏。
- **冲突面**：
  - 装饰层盖在输入框上 → 打不了字、点不到发送；
  - 插件监听 `keydown` 却没排除输入框 → 把用户输入吃掉（或反之，在输入框里按键触发插件功能）；
  - 用固定高度/绝对定位让输入框在窄窗下被裁切。
- **锚点**（⚠ 均未在官方文档中确认）：`data-composer-input`（主锚，来源为第三方文档）、
  `data-composer-card`、官方主题 token `--dsw-*` 中的输入区相关项。

## 2. 标记

| 载体 | 谁写 | 谁读 | 说明 |
|---|---|---|---|
| `data-composer-input` | 宿主 | 所有人（只读） | ⚠ 未在官方代码中确认，必须三级兜底 |
| `data-dsh-composer="<plugin-id>"` | 装饰类插件 | 所有人 | 可选：宣告装饰层归属 |
| `data-<plugin>-*` | 插件自己 | 插件自己 | 私有状态 |

## 3. 条目

### 3.1 装饰层不得吃事件（必须）

**约定**：铺在输入区的装饰层 `pointer-events: none`；只对真正需要点击的小元素开启。

**怎么验**：装饰开启后能正常打字、点发送、点附件、拖入文件。

### 3.2 不得吞按键，也不得在输入框内触发插件快捷键（必须）

**约定**：全局快捷键监听必须排除 `input` / `textarea` / `[contenteditable]` 与输入法组合状态
（`event.isComposing`）。

**为什么**：这是最容易踩的一条。用户中文输入时按下的键若被插件拦走，表现为"打字丢字"。

**怎么验**：在输入框里打一段中文（含候选选择）、敲 Enter 发送；插件快捷键不应被触发。

### 3.3 定位必须三级兜底（必须）

**约定**：先 `[data-composer-input]`，再 `textarea` / `[contenteditable="true"]`，再放弃（不加装饰）。

**怎么验**：把主锚改成不存在的值，装饰降级但不报错、不盖住输入框。

### 3.4 不改变输入区几何（建议）

**约定**：不改输入区的边距/高度/位置；需要加内容时用宿主提供的插槽或在与输入区**不重叠**的位置，
并按容器宽度响应。

**怎么验**：窄窗、侧栏展开/收起、多行输入时都不裁切、不重叠。

### 3.5 尊重移动端安全区（建议）

**约定**：如涉及底部固定元素，使用 `env(safe-area-inset-bottom)` 一类安全区变量。

## 4. 配置口径

| 字段 | 默认 | 含义 |
|---|---|---|
| `composer.decorate` | `true` | 是否在输入区加装饰 |
| `composer.shortcuts` | `true` | 是否启用插件自己在该区域的快捷键 |

## 5. 责任划分

| 事项 | 宿主负责 | 插件负责 | 仅使用该能力时适用 |
|---|---|---|---|
| 输入框本身可用 | ✅ | | |
| 装饰不吃事件、不吞键 | | ✅ | ✅ |
| 锚点兜底 | | ✅ | ✅ |
| 窄窗/多行下不裁切 | | ✅ | ✅ |

## 6. 参考实现：安全的全局快捷键

```js
/** 判断事件是否应交给输入框处理（此时插件快捷键必须让路）。 */
function isTypingTarget(event) {
  if (event && event.isComposing) return true            /* 输入法组合中 */
  var t = event && event.target
  if (!t || !t.tagName) return false
  var tag = t.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  return !!(t.isContentEditable || (t.closest && t.closest('[contenteditable="true"]')))
}

document.addEventListener('keydown', function (e) {
  if (isTypingTarget(e)) return                             /* 让路 */
  if (e.key === 'k' && (e.metaKey || e.ctrlKey)) { /* 插件快捷键 */ }
}, true)
```

## 7. 自测清单

- [ ] 装饰开启时能打字、点发送、点附件、拖入文件
- [ ] 中文输入（含候选）不丢字；Enter 正常发送
- [ ] 插件快捷键在输入框内不触发，在别处正常
- [ ] 多行输入、长文本、窄窗下输入区不被裁切
- [ ] 把主锚改成不存在的值：装饰降级，输入框仍可用
- [ ] 移动端/触屏：底部不被安全区遮住

## 8. 迁移与回退

- 从"绝对定位覆盖在输入区上方"迁移到"不重叠布局或宿主插槽"；过渡期保留 `composer.decorate:false` 开关。

## 9. 交叉引用

- [anchors.md](./anchors.md)
- [overlay.md](./overlay.md) — 输入区上方的浮层（选择器、菜单）
