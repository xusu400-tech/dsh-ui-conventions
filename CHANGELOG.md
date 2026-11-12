# 变更记录（Changelog）

格式：`公约版本 · 日期 · 模块` 起头，写"改了什么 + 为什么 + 影响谁"。

## v0.1.3 — 2026-11-12

**修复本公约自身造成的启动失败（事故记录见 [cases/boot-global-collision.md](./cases/boot-global-collision.md)）。**

- **契约改名**：`window.__DSH_BOOT__` → `window.__DSH_UI_BOOT__`；`html[data-dsh-boot]` → `html[data-dsh-ui-boot]`；
  事件 `dsh:boot-claim|release` → `dsh-ui-boot:claim|release`。
  原因：`__DSH_BOOT__` 是宿主自有的（客户端模块启动清单，含 `rev`/`release`/`entries`/`batches`），
  被覆盖后宿主报 `client-modules: boot manifest rev must be a string`，**DSH 直接启动失败**（实测 4 次崩溃）。
  代价：第一版契约的兼容性归零——但这比让用户打不开应用好。
- **顺带发现**：`data-dsh-boot` 也被宿主 `dsh-client-ui-renderer` 占用（首帧 hydrate 的占位元素），一并改名。
- **新增规则** `MUST-no-host-global-clobber`（必须）：对登记表 `hostGlobals` 里的宿主全局对象赋值即违规。
  该规则由崩掉的这次事故驱动，夹具已覆盖（self-test 从 14 项变 15 项，must 规则从 5 条变 6 条）。
- **CI** 的"必须命中全部 must 规则"断言同步改为 6 条。

- **重启验证（2026-11-12 21:5x）**：改名后的补丁重新打上，完全重启 **成功**，不再产生 crash 日志。

教训写进了公约总则：**`__DSH_*` 前缀默认属于宿主，采纳前必须在运行中的安装包里核实**；
覆盖全局对象比覆盖 DOM 标记危险得多——后者只是错位，前者会让应用起不来。
## v0.1.2 — 2026-11-12

**检查器两处判定粒度修正**（由"按公约重做两个真实插件"暴露出来）：

- **首屏协调改为按包判定**：覆盖层常定义在 `.css`（如 `runtime/skin.css`、`lib/splash.css`），
  而协调代码在 `.js`；按文件判定会把"同一插件的两个文件"判成"没参与协调"。改为包级参与度 + 包级上限检测。
- **包级判定一律使用"剔除注释后"的文本**：否则夹具/插件注释里的 `__DSH_UI_BOOT__`、`maxMs` 字样会骗过检查
  （该缺陷先由自测夹具发现，这里补齐到包级路径）。
- **统一字段名判定放宽**：插件里的写法可能是 `bootCfg.priority` 或 `C.boot.priority`，
  改为"四个字段名出现两个以上"即视为按公约命名。

**案例更新**：`cases/boot-video-skin-vs-boot-suite.md` 补上结局——两个插件已按公约提交 PR（各 2 个提交），
并给出打补丁前后的必须级违规数（video-skin 3→1、boot-suite 11→3，两条首屏规则均已清零）。

## v0.1.1 — 2026-11-12

**新增案例库** [cases/](./cases/)：把真实冲突写成带**确切插件版本号与实测证据**的档案。

- `dsh-video-skin@0.1.6` × `dsh-boot-suite@2.16.13`：首屏被两个全屏层同时占用
  （`z-index` 2147483647 vs 2147483000），视频盖住六幕动画且音频重叠。含两插件当时的检查器结果。
- `dsh-video-skin@0.1.6` × `dsh-wallpaper-engine`（**对方版本未记录**，如实标注为本案例缺陷）：
  局内背景层的只读标记互让（`data-we-wallpaper` ↔ `data-dsvs-background`）。

**为什么单列案例库**：插件会升级、数值会变。把"环境 + 版本 + 证据 + 当时的检查结果"固定下来，
日后现象变了才能判断是插件改了，还是这份结论过期了。案例库因此规定**版本号必须写全**。

## v0.1 — 2026-11-12

首版，确立框架并覆盖第一批模块。

**框架**
- 采用三级强度（必须 / 建议 / 可选）+ 独立 ⚠ 标记（宿主未承诺）。借自[工作台开发规范](https://dshdesktop.com/workbench/docs/development/)的形式。
- 确立命名法：锚点沿用官方 `data-plugin` / `data-plugin-css`；跨插件共享用 `data-dsh-<module>-*`；私有 `data-<plugin>-*`；事件 `dsh:<module>-<verb>`；全局 `__DSH_<MODULE>__`；CSS 变量只读 `--dsw-*`。
- 所有结论登记出处（[SOURCES.md](./SOURCES.md)），⚠ 条目必须带实测版本与日期。

**新增模块**
- `anchors` — 首次把"事实标准但未文档化"的锚点写成清单：官方 139 个 `dsh-client-*` 包中 53 个写 `data-plugin` / `data-plugin-css`，第三方已在读，而官方文档 0 命中。标 ⚠ 并要求三级兜底。
- `boot` — 首屏独占资源：认领/释放、优先级不抢占、4s 宽限 + 120s 等待上限、超时接棒、必须可跳过、绝不黑屏。附**已验证**参考实现（14 个场景测试）。
- `background`、`theme`、`sidebar`、`composer`、`settings-slot`、`window-chrome`、`overlay` — 首批草案，多为"共享资源 + 只读锚点 + 责任划分"的骨架，条目会在实测后增补。

**新增工具**
- `checks/dsh-ui-lint.mjs` — 12 条规则的静态检查器（6 必须 / 4 建议 / 1 可选 / 1 warn）。
- `checks/self-test.mjs` + `examples/{good,bad}-plugin` — 检查器自身的门槛：合规包不得报必须级违规，违规包必须精确命中预期规则。

**为什么现在做**
两个真实冲突促成了它：
1. `dsh-video-skin` 与 `dsh-boot-suite` 同时安装时两段开机动画**同时播放**（z-index 2147483647 vs 2147483000），视频盖住六幕动画、声音重叠。两者互不认识：video-skin 的让路机制只覆盖局内背景层，且只认 `dsh-wallpaper-engine` 的标记。
2. `dsh-video-skin` 与 `dsh-wallpaper-engine` 抢同一层背景，各自用私有只读标记互相避让——同一类问题在不同插件里被发明了两遍。

**影响谁**
- 首屏类插件作者：`boot.md` 的认领/释放要求。
- 皮肤/主题类插件作者：`theme.md` 与 `anchors.md` 的 token 与锚点规则。
- 任何会写 `data-*` 的插件：`MUST-namespace-own` 与 `MUST-no-host-marker-write`。

## 待办（下一版候选）

- `background` / `theme` 增加实测条目（多皮肤共存、token 派生关系）。
- 把"宿主是否愿意承诺 `data-plugin`"作为议题提给官方；若承诺，对应 ⚠ 可升级。
- 检查器增加"孤儿 CSS / 路由注入资源"的更完整覆盖（当前用"目录名引用"启发式补扫）。

## 首批实测结果（2026-11-12 · DSH 0.2.2-rc.2）

用检查器跑本机 profile 里真实的同类插件，验证工具是否可用（也是首次真实校准）：

| 插件 | 必须级 | 结论 |
|---|---|---|
| `dsh-video-skin@0.1.6` | 3 | 两段开机动画确实**未参与首屏协调**（`.dsvs-boot` 是全屏层、`z-index: 2147483647`，只写了私有 `__DSVS_BOOT_STATE__`）；另有 `data-slot` 裸名与他人重叠 |
| `dsh-boot-suite@2.16.13` | 11 | 未参与首屏协调（用自有的 `__DSH_STARTUP_*` 体系）；`data-phase` 裸名与他人重叠；多处 `--dsw-*` 全局覆盖 |

**校准过程中修掉的自身缺陷**（都写进了规则或边界说明）：

1. 最初把测试/脚本/构建工具也当运行时代码扫描 → 大量误报。改为**只扫运行时入口图**。
2. 行内样式里的 `var(--dsw-*)` **读取**被误判为"定义"。改为只判"全局覆盖"（`:root`/`html`/`body`/`documentElement`），子树内的 scoped 覆盖降级为可选提示。
3. `data-plugin-css` 一度被列为"宿主内部、禁止写入"——与"给自己的根元素标 `data-plugin`"自相矛盾，而官方 53 个包与两个第三方插件都在给自己的样式表打这个标。改为**所有权标记**（可写自己的，不可改写他人的）。
4. 注释里出现 `__DSH_UI_BOOT__` / `maxMs` 字样会骗过"是否参与/是否有上限"的判定（本仓库自测夹具抓到的假阴性）。改为**先剔除注释再判定**。
5. 宿主用路由注入的客户端资源（如 `runtime/skin.css`）不在 `import` 图里，导致漏检。增加"目录名引用"补扫。
