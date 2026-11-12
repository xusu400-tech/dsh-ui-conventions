# 案例：两个插件都想当背景

- **实测日期**：2026-11-12（结论来自 `dsh-video-skin` 自己的文档与代码，非本机同时安装实测）
- **环境**：DSH Desktop `0.2.2-rc.2` · Windows 10.0.19045
- **插件**：`dsh-video-skin@0.1.6` × `dsh-wallpaper-engine`（**版本未记录** —— 这是本案例的缺陷，见文末）
- **冲突资源**：局内背景层（`z-index: -1` 那一层 + 页面表面半透明化 token）—— 见 [background 公约](../conventions/background.md)

## 现象

两个插件都管理"页面背景"时：

- `dsh-video-skin` 的 `#dsvs-backdrop`（`z-index: -1`）会盖住对方的壁纸，对方看不到自己的画；
- 双方都想改页面表面 token（半透明化），叠加后画面被压暗；
- 双方都认为自己"在管背景"，但用户只看到其中一个（或一个都不完整）。

## 证据

来自 `dsh-video-skin@0.1.6` 的 README §3.7 与源码注释（该节正是为上游 issue #4 写的）：

| 事实 | 位置 |
|---|---|
| 让路判据：读对方挂在 `body` 上的 `data-we-wallpaper`（值非 `off`/`false`/`0` 即"有壁纸在台上"） | `README.zh.md` §3.7、`runtime/skin.js`（`NS` 附近注释，注明来源是对方 `src/client.js:62` 的 `ACTIVE_ATTR`） |
| 对外暴露只读标记 `html[data-dsvs-background="on"]`（"此刻本插件真的在管背景"） | 同上 |
| 三种模式 `auto`（默认让路）/ `own`（始终接管）/ `off`（不参与） | `lib/config.js` 的 `background.mode` |
| 已知边界：切到 `own` 时，对方的 `.we-scrim`（同为 `z-index:-1` 但更晚插入 DOM）会**按文档序**压在自己的视频上，画面被压暗 | `README.zh.md` §3.7 末尾 |

## 根因

1. **同类资源被两套私有约定分别解决**：`data-we-*`（wallpaper-engine）与 `data-dsvs-*`（video-skin）都是
   **只读 DOM 标记**，能解决问题，但每个插件只认识自己适配过的那一个。
2. **这是 O(N²) 结构**：第三个壁纸插件出现时，需要与已有的每一个再约定一次。
3. **让路是"背景"层的概念，不适用于首屏**：video-skin 明确写"开机动画不在这一层，所以始终保留"——
   所以同一个插件在**两个不同资源**上需要两套不同的协调逻辑（背景让路 / 首屏认领）。

## 公约如何解决

[background 公约](../conventions/background.md) 把"背景归属"统一成一个共享标记与一套默认策略：

- 统一形态 `data-dsh-background="<plugin-id>"`（值即占用者；让路时移除）；
- 默认 `mode: auto` **让路**——检测到别人在管就不建背景层、不挂标记，对方撤掉后自动接回；
- 背景层必须在内容之下（负 z-index）且 `pointer-events: none`；
- 半透明化必须有**可读性下限**，面板/弹层建议保留不透明；
- 背景视频延迟加载（界面就绪后），不抢首屏带宽。

与 video-skin 现有实现的关系：它已经是"让路"的形态，迁移只需**双写**共享标记（保留 `data-we-something`
一段时间），行为不变。

## 本案例的缺陷（如实记录）

**`dsh-wallpaper-engine` 的版本号没有记录。** 当时只读到对方标记的来源注释（`src/client.js:62`），
没有确认具体版本。后果：如果对方后来改了标记名或让路语义，本案例无法判断"是它变了还是我们记错了"。

→ 这正是 [案例库 README](./README.md) 把"版本号必须写全"列为硬要求的原因。下次实测请补：

```powershell
# 记录参与插件的确切版本
node -e "const p=require('C:/Users/<user>/.dsh/profiles/desktop/node_modules/dsh-wallpaper-engine/package.json'); console.log(p.name, p.version)"
```

## 后续

- `dsh-video-skin` 的让路逻辑本身上游已在用，公约把它推广到"任何壁纸类插件"。
- **如果 `dsh-wallpaper-engine` 升版**：先确认 `data-we-wallpaper` 是否仍存在、语义是否仍是"有壁纸在台上"；
  再重跑 `checks/scan-anchors.mjs` 看跨插件读法是否变化。
