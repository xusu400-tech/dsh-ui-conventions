# 案例：公约自己踩了宿主的全局变量（首屏协调导致启动失败）

- **实测日期**：2026-11-12
- **环境**：DSH Desktop `0.2.2-rc.2` · Windows 10.0.19045 · asar 打包
- **涉及**：本公约 [boot](../conventions/boot.md) v1 的**第一版契约**（`window.__DSH_BOOT__`）+ 两个示例实现

> 这是**公约自身的错误**，不是插件作者的错误。写进来是因为它能说明一条硬规则：
> **采纳任何 `__DSH_*` 名字之前，必须在运行中的应用里核实它没有被宿主占用。**

## 现象

按公约第一版打完补丁后，完全退出并重新启动 DSH Desktop，**启动直接失败**，4 次尝试全部崩溃（13:28 / 13:29 / 13:33 / 13:37）。

崩溃日志（`%APPDATA%\@deepseek-ai\dsh-desktop\logs\crash-*-web-boot.log`）：

```
phase: running
app: @deepseek-ai/dsh-desktop 0.2.2-rc.2

--- error ---
Error: client-modules: boot manifest rev must be a string
    at .../resources/app.asar/lib/main.js:20822

--- renderer console ---
dsh-app://app/assets/index-ghOpC9uV.js:198 Error: client-modules: boot manifest rev must be a string
```

界面停在启动阶段，无法进入应用。

## 根因

宿主自己就用 `window.__DSH_BOOT__` 这个全局变量：

```js
// @deepseek-ai/dsh-client-modules/lib/client.js（安装包内）
function parseBootManifest(wire) {
  if (typeof wire !== 'object' || wire === null) throw new Error('client-modules: window.__DSH_BOOT__ is missing or not an object')
  const graph = wire
  if (typeof graph.rev !== 'string') throw new Error('client-modules: boot manifest rev must be a string')
  ...
}
```

它携带的是**客户端模块启动清单**：`rev`（缓存击穿用的版本串）、`release`、`entries`、`batches`。
而公约第一版的 `claim()` 干了这件事：

```js
W.__DSH_BOOT__ = { v: 1, owner: 'dsh-video-skin', priority: 100, since: ..., maxMs: ... }
```

于是宿主的清单被覆盖成一个没有 `rev` 的对象；宿主随后解析它 → `rev` 不是字符串 → 抛错 → **启动失败**。

## 谁占用了这个名字（实测）

安装包内 `__DSH_BOOT__` 出现在（非完整清单）：

| 文件 | 用途 |
|---|---|
| `@deepseek-ai/dsh-client-modules/lib/{client,index}.js` | 启动清单的生成与解析（就是崩溃点） |
| `@deepseek-ai/dsh-experimental-inspector/lib/client.js` | 检查器读取清单 |
| `@deepseek-ai/dsh-harness-dev-context/lib/index.js` | 开发上下文 |
| `@deepseek-ai/dsh-tool-cordis/lib/types/api-catalog.js` | 类型目录 |

同样被占用的还有 **`data-dsh-boot`**（`dsh-client-ui-renderer/lib/client.js` 用它标首帧 hydrate 的占位元素），
所以公约里那个 DOM 标记也必须换名——**这一点第一版也没查到**。

## 修复

契约整体换到一组已核实为空闲的名字（同一台机器、同一版本实测）：

| 用途 | 第一版（冲突） | 现在 | 占用情况 |
|---|---|---|---|
| 全局快照 | `window.__DSH_BOOT__` | `window.__DSH_UI_BOOT__` | FREE |
| DOM 投影 | `html[data-dsh-boot]` / `-since` | `html[data-dsh-ui-boot]` / `-since` | FREE |
| 事件 | `dsh:boot-claim` / `dsh:boot-release` | `dsh-ui-boot:claim` / `dsh-ui-boot:release` | FREE |

并在检查器里新增一条规则，防止同类错误再犯：

| 规则 | 强度 | 检查 |
|---|---|---|
| `MUST-no-host-global-clobber` | 必须 | 是否对登记表里**宿主自有的全局对象**赋值（`window.X = …` / `window['X'] = …`） |

登记表在 `checks/known-namespaces.json` 的 `hostGlobals`，目前含 `__DSH_BOOT__`。

## 怎么在采纳新名字前自检

在**运行中的** DSH 安装包里搜一遍（asar 内文件，不是磁盘上的 node_modules）：

```powershell
# 用本仓库之外的方式也可以：直接在 asar 的 dsh/ 目录内搜文本
# 关键点：搜的是安装包（asar）内的 dsh/ 前缀文件，宿主代码都在那里
Select-String -Path "<asar 解出的目录>\dsh\**\*.js" -Pattern '__DSH_UI_BOOT__' -List
```

本仓库的 `checks/scan-anchors.mjs` 只扫已安装插件（第三方），**不扫宿主**；
宿主侧的核实是一次性的、需要读 asar，所以结论写在这里并标注版本，以便过期时重查。

## 教训（写进公约总则）

1. **`__DSH_*` 前缀默认属于宿主**。第三方要在这个命名空间里取名，必须先在安装包里核实为空闲，
   并把"实测版本 + 日期"写进文档。
2. **覆盖全局对象比覆盖 DOM 标记更危险**：DOM 标记改错只是错位，全局对象被改会让**启动直接失败**，
   用户连界面都进不去。
3. **检查器必须有"宿主保留"这一类规则**，而且这条规则要能静态判定（`window.X =` 是纯文本特征，可判定）。

## 后续

- 公约契约已改名（`boot.md` v1 修订），检查器新增 `MUST-no-host-global-clobber` 并有夹具覆盖；
- 两个插件的补丁已按新名字重打，审计结果：**对宿主全局的赋值 0 处**，`__DSH_BOOT__` 出现 0 次；
- 若将来宿主正式把首屏协调纳入自己的能力（如 `ctx.boot.register()`），本公约应整体退役，
  而不是继续在 `window` 上开洞。
