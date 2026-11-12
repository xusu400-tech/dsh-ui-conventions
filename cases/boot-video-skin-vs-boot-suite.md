# 案例：两个开机动画同时播放

- **实测日期**：2026-11-12
- **环境**：DSH Desktop `0.2.2-rc.2` · Windows 10.0.19045 · 安装形态：asar 打包
- **插件**：`dsh-video-skin@0.1.6`（作者 Something11235） × `dsh-boot-suite@2.16.13`（作者 沈宏宏 · LeeRolling）
- **冲突资源**：首屏（独占）—— 见 [boot 公约](../conventions/boot.md)

## 现象

两个插件都安装并启用后冷启动：

1. 视频播放在最上层可见；
2. 六幕动画在**下面同时从头播放**（用户看不见）；
3. 视频播完（或被点击跳过）后，**露出六幕动画的中段**，不是从头；
4. **两边的音频同时响**。

用户描述为"两个开机动画打架"，观感是"动画放到一半突然换了一个"。

## 证据

覆盖层层级（读代码所得）：

| 插件 | 覆盖层 | `z-index` | 位置 |
|---|---|---|---|
| `dsh-video-skin@0.1.6` | `.dsvs-boot` | **2147483647** | `runtime/skin.css` |
| `dsh-boot-suite@2.16.13` | `#dsh-startup-root` | **2147483000** | `lib/splash.css`（`lib/splash.js` 另有 `2147483647` 的退路） |

两者都是 `position: fixed; inset: 0`。视频的层级更高，所以"盖住 + 同时播放"。

复现：两个插件同时启用 → 完全退出 DSH Desktop → 重新打开 → 观察首屏。

## 根因（不是"谁做错了"）

1. **宿主没有首屏扩展点**：安装包里 `boot.splash` / `bootSequence` / `startupStage` 0 命中，官方文档里
   `splash` / 启动画面 0 命中。宿主的客户端启动模型只解决**代码加载顺序**
   （`dsh.client` → boot manifest 的 `bootstrap` / `application` 两阶段 + 依赖拓扑序），不解决**画面顺序**。
2. **于是每个插件只能自己抢首屏**：都挂全屏 fixed 层、都把 z-index 顶到接近 int 上限。没有仲裁者时，
   谁在上面取决于数值与挂载顺序。
3. **`dsh-video-skin` 已有的共存机制覆盖不到这里**：它 README §3.7 的"自动让路"只针对**局内背景层**
   （`z-index: -1` 那一层 + 页面半透明化 token），且只识别 `dsh-wallpaper-engine` 在 `body` 上挂的
   `data-we-wallpaper` 标记。文档原文明确："**开机动画不在这一层，所以始终保留**""整个过程**不碰开机动画**"。
4. 两个插件**互不认识**：`dsh-boot-suite` 用的是自己的 `__DSH_STARTUP_*` 体系，`dsh-video-skin` 不读它。

## 公约如何解决

[boot 公约](../conventions/boot.md) 把首屏定义成**独占资源**：

1. 播放前**认领**，只有一个 owner；
2. **开始淡出时释放**（不是淡出结束），下一段无缝接上；
3. 优先级小者先播，但**永不抢占**；
4. 播放者必须自设硬上限、可跳过、失败/超时都要释放（**绝不黑屏**）；
5. 等待者宽限 `graceMs` 探测（兼容不遵守公约的插件）、等待上限 `waitCapMs`、台上者僵死时接棒。

统一载体：`window.__DSH_BOOT__` + `html[data-dsh-boot]` + 事件 `dsh:boot-claim` / `dsh:boot-release`。

## 当时的合规检查结果

用 `checks/dsh-ui-lint.mjs`（本案例发生时）在 DSH 0.2.2-rc.2 上实测：

```
dsh-video-skin@0.1.6        必须级 3 条
  MUST-boot-claim   存在全屏覆盖层但未参与首屏协调（runtime/skin.css）
  MUST-boot-cap     存在全屏覆盖层但没有硬上限（runtime/skin.css）
  MUST-namespace-own 使用了生态中已被占用的裸名：data-slot（runtime/skin.js:1794）

dsh-boot-suite@2.16.13      必须级 11 条
  MUST-no-host-marker-write 写入宿主内部标记：dataset.pluginCss（lib/client.js）
  MUST-boot-claim   lib/client.js、lib/host-startup.js、lib/splash.css、lib/splash.js
  MUST-boot-cap     同上四处
  MUST-namespace-own 使用了生态中已被占用的裸名：data-phase（lib/splash.js:1065、1150）
```

> 数值随工具演进会变（例如 `data-plugin-css` 后来从"宿主内部标记"改为"所有权标记"，就不再计违规）。
> **这就是要写版本号与日期的原因。**

## 后续

两个插件按本公约的实现已以 PR 提交，**最终态都是公约实现**（每个 PR 两个提交：第一个是私有标记的过渡方案，
第二个改为公约）：

| 插件 | PR | 公约落地方式 |
|---|---|---|
| `dsh-boot-suite` | [LeeRolling/dsh-boot-suite#7](https://github.com/LeeRolling/dsh-boot-suite/pull/7) | `run()` 入口用 `whenFree()` 等待 → `claim()`；`finish()`（唯一揭幕出口）里 `release('ended')`；`maxMs` 默认 60s（六幕+第二幕较长） |
| `dsh-video-skin` | [Something11235/dsh-video-skin#8](https://github.com/Something11235/dsh-video-skin/pull/8) | 他人占台时本次不播（不叠层不抢占）；覆盖层上屏 `claim()`；`enter()`（所有退场路径的出口）里 `release(reason)` |

**打上公约补丁后，用检查器复检的必须级违规数**（同一台机器同一天）：

| 插件 | 补丁前 | 补丁后 | 残留 |
|---|---|---|---|
| `dsh-video-skin` | 3 | **1** | 裸名 `data-slot`（与首屏无关） |
| `dsh-boot-suite` | 11 | **3** | `dataset.pluginCss`、两处裸名 `data-phase`（均与首屏无关） |

`MUST-boot-claim` / `MUST-boot-cap` 在两个插件上**均已清零**——即首屏冲突从此案角度看已解决。

**如果插件升到更高版本**：先看它是否已内建首屏协调（搜索 `__DSH_BOOT__`）；再重跑检查器。
两个插件若已按公约实现，本案例现象应消失，`MUST-boot-claim` / `MUST-boot-cap` 也应保持为零。
若上游合并后自行改动了实现细节，请以**它们发布版本的实际代码**为准更新本案例的对照表。

相关：局内背景层的同类冲突见 [另一个案例](./background-video-skin-vs-wallpaper-engine.md)。
