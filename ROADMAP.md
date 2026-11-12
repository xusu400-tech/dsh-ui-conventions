# 模块清单与路线（Roadmap）

按"会互相影响的资源"划分模块，而不是按插件功能划分——因为冲突总是发生在资源上。

| 模块 | 文档 | 共享资源 | 状态 |
|---|---|---|---|
| DOM 锚点（基础） | [conventions/anchors.md](./conventions/anchors.md) | 全站 DOM 结构 | 草案 |
| 首屏 / 开机动画 | [conventions/boot.md](./conventions/boot.md) | 首屏（独占） | 草案（含已验证参考实现） |
| 局内背景 / 壁纸 | [conventions/background.md](./conventions/background.md) | 内容层背景 + 表面半透明 | 草案 |
| 主题 / 配色 | [conventions/theme.md](./conventions/theme.md) | `--dsw-*` token | 草案 |
| 侧栏 | [conventions/sidebar.md](./conventions/sidebar.md) | 侧栏布局与折叠态 | 草案 |
| 输入框区 | [conventions/composer.md](./conventions/composer.md) | 底部输入区几何与锚点 | 草案 |
| 设置页插槽 | [conventions/settings-slot.md](./conventions/settings-slot.md) | 设置页分区与命名 | 草案 |
| 窗口外观 / 拖拽 | [conventions/window-chrome.md](./conventions/window-chrome.md) | 标题栏、拖拽区、留白 | 草案 |
| 浮层 / 面板 / 提示 | [conventions/overlay.md](./conventions/overlay.md) | 顶层叠放与焦点 | 草案 |
| 资源与素材加载 | 待写 | 路由/信任栅栏、素材体积 | 规划 |
| 消息渲染增强 | 待写 | 消息 DOM 结构 | 规划 |
| 插件身份与图标 | 待写 | 插件页展示 | 规划 |

## 真实案例

- [首屏：两个开机动画同时播放](./cases/boot-video-skin-vs-boot-suite.md)（`dsh-video-skin@0.1.6` × `dsh-boot-suite@2.16.13`）
- [背景层：两个插件都想当背景](./cases/background-video-skin-vs-wallpaper-engine.md)（`dsh-video-skin@0.1.6` × `dsh-wallpaper-engine`，对方版本未记录）

## 优先级依据

1. **已经发生过冲突的**优先：首屏（两个开机动画插件实测同时播放）、背景（video-skin 与 wallpaper-engine 打架，已各自打补丁）、主题（多皮肤插件抢 token）。
2. **独占资源**优先于"只读展示"：首屏、背景层、标题栏拖拽区、焦点。
3. **能被检查器验的**优先，让公约可执行而不是可阅读。

## 写法要求（每个模块文档统一）

1. 顶部 front matter（`module` / `convention` / `dsh-verified` / `doc-revised` / `status`）。
2. 共享资源是什么、为什么需要独占或避让。
3. 条目表：三级强度 + 具体标记/事件/字段。
4. 责任划分：宿主负责 / 插件负责 / 仅使用该能力时适用。
5. 勾选自测清单（作者发布前逐条过）。
6. 迁移与安全回退。
7. 与其他模块的交叉引用。
