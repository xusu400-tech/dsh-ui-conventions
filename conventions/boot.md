---
module: boot
convention: v1
dsh-verified: 0.2.2-rc.2
doc-revised: 2026-11-12
status: draft
---

# 首屏 / 开机动画公约

> 首屏是**独占资源**：同一时刻只能有一个插件在台上播动画。本模块用最小机制（DOM 标记 + 事件 +
> 一个全局快照）让多个开机动画插件**串行播放**，而不是同时抢屏。

## 1. 共享资源与冲突面

- **共享资源**：冷启动时覆盖整个窗口的首屏层，以及随之播放的音频。
- **实测过的冲突**（0.2.2-rc.2 / Windows 10，2026-11-12）：
  `dsh-video-skin@0.1.6` 的 `.dsvs-boot` 是 `z-index: 2147483647`，`dsh-boot-suite@2.16.13` 的
  `#dsh-startup-root` 是 `2147483000`。两者同时安装时：视频盖在最上层可见，六幕动画在下面**同时从头播**，
  视频退场才露出动画中段，**两边声音重叠**。
- **为什么不能靠"让路"解决**：`dsh-video-skin` 的共存机制（其 README §3.7）只覆盖**局内背景层**，
  且只认 `dsh-wallpaper-engine` 的 `data-we-wallpaper`；它明确写"开机动画不在这一层""不碰开机动画"。
  两者互不认识。
- **宿主没有这个扩展点**：`boot.splash` / `bootSequence` / `startupStage` 在安装包里 0 命中，官方文档
  里 `splash` / 启动画面 0 命中。宿主只提供**代码加载顺序**（`dsh.client` 的 `bootstrap`/`application`
  两阶段 + 依赖拓扑序），不提供画面顺序。
- **不归本模块管的**：局内背景（见 [background](./background.md)）、主题 token（见 [theme](./theme.md)）。

## 2. 标记与事件

| 载体 | 谁写 | 谁读 | 说明 |
|---|---|---|---|
| `window.__DSH_UI_BOOT__` | 占用者写（认领/释放） | 所有人 | 快照：`{ v: 1, owner, priority, since, maxMs }`；空闲时 `owner: null` |
| `html[data-dsh-ui-boot]` / `[data-dsh-ui-boot-since]` | 占用者 | 不读 JS 的消费者、排障 | 与快照同步投影；空闲时移除 |
| 事件 `dsh-ui-boot:claim` | 占用者 | 等待者 | `detail: { id, priority, maxMs }` |
| 事件 `dsh-ui-boot:release` | 占用者 | 等待者 | `detail: { id, reason }`，`reason ∈ ended/skipped/failed/timeout/disabled` |

**只写自己的命名空间**：任何插件只允许把 `owner` 写成自己的 id，且只在"当前空闲"时写。
禁止改写他人的值、禁止删除他人写的属性。

### 名字为什么是 `__DSH_UI_BOOT__` 而不是 `__DSH_BOOT__`（必读）

`window.__DSH_BOOT__` **是宿主的**：它携带客户端模块启动清单（`rev` / `release` / `entries` / `batches`）。
本公约第一版误用了这个名字，`claim()` 覆盖它之后宿主解析清单失败，**DSH 直接启动失败**：

```
Error: client-modules: boot manifest rev must be a string
```

完整记录见 [案例](../cases/boot-global-collision.md)。同一个坑还有 `data-dsh-boot`
（宿主 `dsh-client-ui-renderer` 用它标首帧 hydrate 的占位元素），所以 DOM 标记也必须是 `data-dsh-ui-boot`。

**规则**：`__DSH_*` 前缀默认属于宿主。采纳任何该前缀的名字之前，必须在**运行中安装包的 asar 内**
核实它没有被占用（扫描方法见案例文档），并把"实测版本 + 日期"记在这里。
`__DSH_UI_BOOT__` 的核实结果：DSH Desktop `0.2.2-rc.2` / 2026-11-12，**未占用**。

## 3. 条目

### 3.1 播放前必须认领（必须）

**约定**：插入全屏覆盖层之前，先确认 `__DSH_UI_BOOT__.owner` 为空（或就是自己），再写入自己的 id。

**为什么**：不认领就是"抢屏"——两个插件同时挂全屏层，用户看到的是随机叠层与重叠音频。

**怎么验**：同装两个首屏插件，只应有一个在播。规则 id：`MUST-boot-claim`。

**失效时**：若读不到 `__DSH_UI_BOOT__`（宿主/浏览器限制），退化为"宽限探测"（见 3.7），不得直接抢。

### 3.2 必须在**开始淡出**时释放（必须）

**约定**：`release` 的时刻是覆盖层开始淡出的那一刹那，**不是**淡出结束、更不是 DOM 移除之后。

**为什么**：下一段通常以深色第一帧起手。等淡出结束再交接，用户会看到一段"什么都没有"的空窗；
提前释放则能形成交叉溶解。

**怎么验**：两个插件串行时，交接处不应出现空白帧。规则 id：`MUST-boot-claim`（含释放路径检查）。

**失效时**：无——这是时序要求。

### 3.3 必须自设硬上限（必须）

**约定**：配置项 `maxMs` 必须有值（建议默认 ≤ 20000），到点无条件 `release('timeout')`，即使素材没播完。

**为什么**：没有上限时，一个卡住的视频/iframe 会把首屏永久占住，用户进不了界面。

**怎么验**：把素材换成一个永不结束的流，`maxMs` 后应自动进入界面。规则 id：`MUST-boot-cap`。

**失效时**：无。

### 3.4 绝不黑屏（必须）

**约定**：素材 404 / 解码失败 / 抛异常 / 超时 → `release('failed')` 并揭幕。任何情况下界面不得停在无内容状态。

**为什么**：这是**优先于"把我的动画播完"**的约束。一个坏素材不应该让用户打不开应用。

**怎么验**：删掉素材文件后冷启动，应正常进入界面（可能无动画）。规则 id：`MUST-boot-cap`。

**失效时**：无。

### 3.5 必须可跳过（必须）

**约定**：播放期间允许用户点击/按键跳过，跳过立即 `release('skipped')`。

**为什么**：用户第二次看到同一段动画时通常不想再看。没有跳过入口等于强制等待。

**怎么验**：点击画面/按键，应立即进入下一段或揭幕。规则 id：`SHOULD-skip`（静态可查的是"存在跳过入口"）。

**失效时**：无。

### 3.6 等待者不得叠层（必须）

**约定**：在等待期间**不得**插入自己的覆盖层（哪怕透明或用 `visibility: hidden`）。

**为什么**：透明层也会吃掉点击、抢走焦点；一旦对方延迟，用户会看到"点了没反应"。

**怎么验**：两个插件同装时，等待中那个不应在 DOM 里留下全屏节点。规则 id：`MUST-boot-claim`。

**失效时**：无。

### 3.7 宽限探测，兼容不遵守公约的插件（必须）

**约定**：启动时若没有 `__DSH_UI_BOOT__`，先等 `graceMs`（建议 4000）。期间有人认领 → 正常等待；
始终没人认领 → 认为无人在台上，照常开播。

**为什么**：公约是自愿的。如果等待"永远等不到"，遵守者会被不遵守者拖死——那没人愿意遵守。

**怎么验**：只装自己一个插件，启动不应有可感知的额外延迟（最多 `graceMs`）。规则 id：`MUST-boot-claim`。

**失效时**：无。

### 3.8 等待必须有上限（必须）

**约定**：等待他人时设置 `waitCapMs`（建议 120000），到点无条件开播。

**为什么**：台上者可能崩溃、可能被用户切走。没有上限就是把用户锁在等待里。

**怎么验**：模拟台上者永不释放，`waitCapMs` 后应开播。

**失效时**：无。

### 3.9 台上者僵死时接棒（必须）

**约定**：若 `now - since > maxMs + slackMs`（`slackMs` 建议 2000），视为台上者违约，强制接棒：
把自己写为 owner 并开播。

**为什么**：刷新页面、进程被杀都会留下"僵尸 owner"。没有接棒机制，一次异常会让首屏永久空转。

**怎么验**：手动写一个 `since` 很旧、`owner` 不存在的快照，另一插件应能接棒。

**失效时**：无。

### 3.10 释放必须幂等（必须）

**约定**：重复 `release` 只生效一次；不是自己当 owner 时调用 `release` 应无副作用。

**为什么**：多路径退出（跳过、超时、失败、卸载）都会调释放，不幂等会把别人的认领擦掉。

**怎么验**：连续调用两次，第二次应返回 false 且不改快照。

**失效时**：无。

### 3.11 优先级只在认领时比较，永不抢占（必须）

**约定**：`priority` 小者先播；但已在台上的插件**不会**被更高优先级者打断。

**为什么**：抢占会造成视觉抖动（播到一半被切走），且实现复杂度陡增。宁可让先到者播完。

**怎么验**：后启动的高优先级插件应等前者释放，而不是顶掉它。

**失效时**：无。

### 3.12 配置字段名统一（建议）

**约定**：用下表字段名，放在插件自己的用户级配置里。

**为什么**：用户不该为每个插件记一套名字；检查器也据此判断"是否可配置"。

**怎么验**：配置文件里出现 `boot.priority` / `maxMs` / `waitCapMs` / `graceMs`。规则 id：`SHOULD-config-naming`。

**失效时**：保留旧字段名一段时间，做兼容映射。

### 3.13 用未文档化锚点时必须兜底（⚠）

**约定**：若实现依赖前面实测的 `data-plugin` 等未文档化锚点，必须在 README 登记并在失效时降级。

**为什么**：这些锚点官方未承诺（实测 0 文档命中），随版本可能变化。

**怎么验**：规则 id：`WARN-undocumented-anchor`（只 warn）。

**失效时**：按 [anchors](./anchors.md) 的三级兜底降级。

## 4. 配置口径

| 字段 | 默认 | 含义 |
|---|---|---|
| `boot.enabled` | `true` | `false` = 完全不参与首屏（等价于 `release('disabled')`） |
| `boot.priority` | `100` | 小者先播 |
| `boot.maxMs` | `20000` | 本段最长占用（硬上限） |
| `boot.waitCapMs` | `120000` | 等待他人时的最长等待 |
| `boot.graceMs` | `4000` | 启动时探测"有没有别的参与方"的宽限 |
| `boot.skippable` | `true` | 是否允许用户跳过 |

## 5. 责任划分

| 事项 | 宿主负责 | 插件负责 | 仅使用该能力时适用 |
|---|---|---|---|
| 提供首屏正式扩展点 | ✅（当前不存在，见 SOURCES） | | |
| 认领 / 释放 / 幂等 | | ✅ | |
| 硬上限、可跳过、绝不黑屏 | | ✅ | |
| 宽限探测与等待上限 | | ✅ | |
| 僵死 owner 接棒 | | ✅ | |
| 在 README 登记 ⚠ 依赖 | | ✅ | ✅ |

## 6. 参考实现

零依赖，可直接复制。**本文件这段代码有测试**（`checks/test-reference-impl.mjs`，14 个场景），
测试按下面的注释标记自动抽取，改动后请重跑。

```js
/** DSH 首屏公约 v1 的最小实现：认领 / 释放 / 等待。 */
function createBootCoordination(options) {
  var id = options.id
  var priority = options.priority == null ? 100 : options.priority
  var maxMs = options.maxMs == null ? 20000 : options.maxMs
  var waitCapMs = options.waitCapMs == null ? 120000 : options.waitCapMs
  var graceMs = options.graceMs == null ? 4000 : options.graceMs
  var slackMs = 2000

  function snapshot() {
    try { return window.__DSH_UI_BOOT__ && window.__DSH_UI_BOOT__.v === 1 ? window.__DSH_UI_BOOT__ : null } catch (e) { return null }
  }
  function write(state) {
    try {
      window.__DSH_UI_BOOT__ = state
      var root = document.documentElement
      if (state && state.owner) {
        root.setAttribute('data-dsh-ui-boot', state.owner)
        root.setAttribute('data-dsh-ui-boot-since', String(state.since))
      } else {
        root.removeAttribute('data-dsh-ui-boot')
        root.removeAttribute('data-dsh-ui-boot-since')
      }
    } catch (e) { /* 标记失败不影响播放 */ }
  }
  function claim() {
    var now = Date.now()
    var next = { v: 1, owner: id, priority: priority, since: now, maxMs: maxMs }
    write(next)
    try { window.dispatchEvent(new CustomEvent('dsh-ui-boot:claim', { detail: { id: id, priority: priority, maxMs: maxMs } })) } catch (e) {}
    return next
  }
  function release(reason) {
    var cur = snapshot()
    if (!cur || cur.owner !== id) return false            /* 幂等：不是我台上就什么都不做 */
    write({ v: 1, owner: null, priority: null, since: null, maxMs: null })
    try { window.dispatchEvent(new CustomEvent('dsh-ui-boot:release', { detail: { id: id, reason: reason || 'ended' } })) } catch (e) {}
    return true
  }
  /** 空闲（或我该接棒）时回调 onGo；本函数保证只回调一次。 */
  function whenFree(onGo) {
    var startedAt = Date.now()
    var done = false
    function go(why) { if (done) return; done = true; try { window.removeEventListener('dsh-ui-boot:release', onRelease) } catch (e) {} onGo(why) }
    function onRelease() { go('release') }
    try { window.addEventListener('dsh-ui-boot:release', onRelease) } catch (e) {}
    var timer = setInterval(function () {
      var s = snapshot()
      var now = Date.now()
      if (!s || !s.owner) return go('free')
      if (s.owner === id) return go('self')
      if (now - s.since > (s.maxMs || 0) + slackMs) return go('took-over-stale')
      if (now - startedAt > waitCapMs) return go('wait-cap')
    }, 120)
    /* 宽限期：没有任何人认领就当作自由，兼容未遵守公约的插件 */
    setTimeout(function () { if (!snapshot()) go('grace-expired') }, graceMs)
    return function cancel() { clearInterval(timer); try { window.removeEventListener('dsh-ui-boot:release', onRelease) } catch (e) {} }
  }
  return { claim: claim, release: release, whenFree: whenFree, snapshot: snapshot }
}
```

用法：

```js
var boot = createBootCoordination({ id: 'my-plugin', priority: 100, maxMs: 20000 })

boot.whenFree(function (why) {
  boot.claim()
  playMyAnimation({
    onExitStart: function () { boot.release('ended') },   /* 或 'skipped' / 'failed' / 'timeout' */
    skip: true,
  })
})
```

## 7. 自测清单

- [ ] 只装我一个：正常播放，无额外等待（`graceMs` 内无人认领即开播）
- [ ] 装两个、我优先级更高：我先播，对方在我释放后开播
- [ ] 装两个、我优先级更低：我后播，且上台前**不在 DOM 留任何全屏节点**
- [ ] 对方被用户跳过：我应在对方**开始淡出**时接上，中间无空窗
- [ ] 我在播时被跳过：立即 `release('skipped')`，对方接上
- [ ] 我的素材 404 / 解码失败：`release('failed')` 并揭幕，**不黑屏**
- [ ] 我的素材卡住不播：到 `maxMs` 强制 `release('timeout')`
- [ ] 对方崩溃留下僵尸 owner：我在 `maxMs + slackMs` 后接棒
- [ ] 对方完全不遵守公约（无任何标记）：我在 `graceMs` 后照常开播，不永久等待
- [ ] `boot.enabled:false`：我不参与、不写标记、不阻塞对方
- [ ] 断网（素材全在包内）：以上全部仍成立

## 8. 迁移与回退

| 旧做法 | 迁移到 | 说明 |
|---|---|---|
| 私有全局状态（如 `__DSVS_BOOT_STATE__`） | `__DSH_UI_BOOT__` 快照 | 双写一段时间 |
| 私有事件（如 `dsvs:boot-exit`） | `dsh-ui-boot:release`（带 `reason`） | 双发一段时间 |
| 代码里的固定 4s/120s 常量 | `boot.graceMs` / `boot.waitCapMs` | 常量改成读配置，默认值不变 |
| 无（直接抢屏） | 认领/释放 | 先加认领与释放，其余保持 |

**回退**：若宿主日后提供了正式 API（例如 `ctx.boot.register(...)`），把认领/释放替换为宿主调用，
保留 `__DSH_UI_BOOT__` 的写入作为 legacy 适配层，直到所有插件迁移完成。

## 9. 交叉引用

- [anchors.md](./anchors.md) — `data-plugin` 等宿主锚点的读法与兜底
- [background.md](./background.md) — 局内背景层（与首屏不同的层，可同时存在）
- [overlay.md](./overlay.md) — 非首屏的浮层与叠放
- 官方：`docs/subsystems/client-modules.md`（说明宿主只负责代码加载顺序）
