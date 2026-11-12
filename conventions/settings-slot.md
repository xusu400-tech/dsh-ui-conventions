---
module: settings-slot
convention: v1
dsh-verified: 0.2.2-rc.2
doc-revised: 2026-11-12
status: draft
---

# 设置页插槽公约

> 设置页是**共享命名空间**：多个插件都会往里加分区。冲突点不是像素，而是**命名、顺序与持久化路径**。

## 1. 共享资源与冲突面

- **共享资源**：设置页的分区（section）列表、其标题与图标、以及"配置存哪里"。
- **冲突面**：
  - 两个插件用同一个 section id / 同一个配置命名空间 → 后装的覆盖先装的；
  - 分区标题无前缀、读者分不清是谁装的；
  - 把配置写进宿主 settings 的第三方命名空间 → 浏览器侧被白名单挡住（`settings-not-exposed`），表现为"设置不保存"。
- **已知机制**（出处见 [SOURCES](../SOURCES.md)）：
  - 宿主侧安装设置分区：`ctx.settings.installSection()`（官方 cookbook `adding-a-settings-card`）。
  - 客户端插槽名（⚠ 第三方文档记录）：`settings.section`、`settings.<plugin>.item`。
  - 浏览器侧 settings 命名空间有**白名单**（`WEB_SETTINGS_NAMESPACES`），第三方命名空间不可用。

## 2. 命名与标记

| 载体 | 规则 | 说明 |
|---|---|---|
| section id / 插槽 id | `settings.<npm 包名>` 或 `<plugin>-settings` | **必须**带自己的包名，避免撞车 |
| 分区标题 | 用插件显示名 + 可选副标题 | 让用户知道这个分区是谁的 |
| 本地化 | 走 Client locale 服务 | 不硬编码中文/英文 |
| 配置存储 | `localStorage` 前缀键 `/ 自家 JSON 文件` | 不要指望第三方 settings 命名空间 |
| `data-plugin="<包名>"` | 分区根元素 | 便于排障与锚点定位 |

## 3. 条目

### 3.1 分区标识必须带自己的包名（必须）

**约定**：section/插槽 id 使用包名派生（如 `settings.dsh-pet`），不得使用 `settings.general`、`settings.appearance`
这类与宿主同名的裸名。

**为什么**：这是共享命名空间里唯一的身份。裸名会与宿主分区或其他插件冲突，且冲突时通常"后写覆盖前写"，
症状是设置项消失或串台。

**怎么验**：安装两个带设置页的插件，两个分区都在且能独立保存。

### 3.2 配置不写第三方 settings 命名空间（必须）

**约定**：第三方插件的配置存 `localStorage`（带自己前缀的键）或插件自己的用户级配置文件。

**为什么**：浏览器侧只暴露白名单命名空间，未在白名单的会返回 `settings-not-exposed`（实测结论）。
按错的路径写，用户会看到"改了设置，刷新就没了"。

**怎么验**：改设置 → 刷新 → 仍在。

### 3.3 设置分区不得遮挡、不得阻塞（必须）

**约定**：分区内不插全屏遮罩、不劫持滚动、不在打开设置页时执行重活（大图/视频解码）。

**为什么**：设置页是排障入口，卡住它会让人无法自救。

### 3.4 标题与控件走本地化（建议）

**约定**：标题、说明、按钮文案走 Client locale；中英各一份。

**怎么验**：切语言后设置分区文字跟随。

### 3.5 提供"恢复默认"（建议）

**约定**：分区底部提供一键恢复默认（并明确会影响什么）。

**为什么**：装饰类插件的设置项多，用户调坏后需要低成本回退。

### 3.6 ⚠ 插槽名未文档化（⚠）

**约定**：使用 `settings.section` 之类的插槽名时按 [anchors](./anchors.md) 三级兜底；若插槽不存在，
降级为"设置项不可用"而不是崩掉。

**怎么验**：把插槽名改成不存在的值，插件仍能加载（只是没有设置 UI）。

## 4. 配置口径

| 字段 | 默认 | 含义 |
|---|---|---|
| `settings.section` | 自动 | 分区 id（带包名） |
| `settings.storage` | `"localStorage"` | 存储方式（`localStorage` / `file`） |

## 5. 责任划分

| 事项 | 宿主负责 | 插件负责 | 仅使用该能力时适用 |
|---|---|---|---|
| 提供设置页插槽与白名单 | ✅（未文档化插槽，⚠） | | |
| 分区标识唯一、带包名 | | ✅ | ✅ |
| 配置持久化 | | ✅ | ✅ |
| 本地化文案 | | ✅ | ✅ |
| 不阻塞设置页 | | ✅ | ✅ |

## 6. 参考实现：带前缀的持久化

```js
/** 带包名前缀的设置读写，避免与别人的键撞车。 */
function createSettingsStore(pkgName, defaults) {
  var KEY = pkgName + ':settings'
  function read() {
    var out = {}
    for (var k in defaults) if (Object.prototype.hasOwnProperty.call(defaults, k)) out[k] = defaults[k]
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || '{}')
      for (var k2 in raw) if (Object.prototype.hasOwnProperty.call(defaults, k2)) out[k2] = raw[k2]
    } catch (e) { /* 损坏就用默认值 */ }
    return out
  }
  function write(values) {
    try { localStorage.setItem(KEY, JSON.stringify(values)) } catch (e) { /* 配额满等，忽略 */ }
  }
  return { key: KEY, read: read, write: write }
}
```

## 7. 自测清单

- [ ] 装两个带设置页的插件：两个分区都在、都能独立保存
- [ ] 设置项改完刷新仍在
- [ ] 切语言后标题/说明跟随
- [ ] 打开设置页不卡顿（无重活）
- [ ] 把插槽名改成不存在的值：插件仍加载，只是没有设置 UI
- [ ] "恢复默认"生效且说明清楚影响范围

## 8. 迁移与回退

- 从裸 section 名迁移到带包名的 id：保留旧 id 读取一段时间（迁移用户已有配置）。
- 回退：设置损坏时回落到默认值，不清空用户的其它数据。

## 9. 交叉引用

- 官方 cookbook：`docs/cookbook/adding-a-settings-card.md`
- [anchors.md](./anchors.md)、[theme.md](./theme.md)（主题类插件的设置入口）
