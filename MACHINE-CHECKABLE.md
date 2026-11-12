# 可机读条目（Machine-checkable）

公约里"必须/建议"的一大半能自动验，这比读文档可靠。检查器随仓库分发，作者在自己的包目录跑一次即可。

## 用法

```powershell
# 检查一个插件包（目录里应有 package.json）
node checks/dsh-ui-lint.mjs "C:\path\to\your-plugin"

# 只看结果，不给退出码（CI 里通常不需要）
node checks/dsh-ui-lint.mjs "C:\path\to\your-plugin" --no-fail

# JSON（给 CI / 其他工具消费）
node checks/dsh-ui-lint.mjs "C:\path\to\your-plugin" --json

# 扫一批（例如整个 profile 的 node_modules）
node checks/dsh-ui-lint.mjs "C:\Users\<user>\.dsh\profiles\desktop\node_modules" --batch
```

退出码：有 **必须** 级违规 → `1`；只有建议/可选/warn → `0`。

## 规则表

| 规则 id | 强度 | 检查内容 | 对应条目 |
|---|---|---|---|
| `MUST-client-manifest` | 必须 | 声明 `dsh.client` 时必须有 `platform`、导出 `./client` 且文件存在 | [anchors](./conventions/anchors.md) |
| `MUST-no-dsw-namespace` | 必须 | 客户端代码不得写/覆盖 `--dsw-*` 自定义属性 | [theme](./conventions/theme.md) |
| `MUST-no-host-global-clobber` | 必须 | 不得改写宿主自有的全局对象（登记表 `hostGlobals`，目前含 `__DSH_BOOT__`）；覆盖会让宿主启动失败 | [anchors](./conventions/anchors.md) |
| `MUST-no-host-marker-write` | 必须 | 不得写宿主内部标记（`data-dsh-compact-toolbar`、`data-dsh-compact-valid`），也不得删除/改写 `data-plugin`、`data-plugin-css` 等所有权标记 | [anchors](./conventions/anchors.md) |
| `MUST-namespace-own` | 必须 | 写 `data-*` 时不得占用**已知属于其他插件**的命名空间 | [anchors](./conventions/anchors.md) |
| `MUST-boot-claim` | 必须 | 创建全屏 `position:fixed` 覆盖层时，必须参与首屏协调（引用 `__DSH_UI_BOOT__` 或 `dsh:boot-*`） | [boot](./conventions/boot.md) |
| `MUST-boot-cap` | 必须 | 有首屏覆盖层时，必须有硬上限（自设上限常量或走 `__DSH_UI_BOOT__` 的 `maxMs`） | [boot](./conventions/boot.md) |
| `SHOULD-plugin-anchor` | 建议 | 全屏/常驻根元素应写 `data-plugin="<包名>"` | [anchors](./conventions/anchors.md) |
| `SHOULD-skip` | 建议 | 全屏覆盖层应提供跳过入口（点击/按键） | [boot](./conventions/boot.md) |
| `SHOULD-config-naming` | 建议 | 首屏相关配置宜用统一字段名（`boot.priority` / `maxMs` / `waitCapMs` / `graceMs`） | [boot](./conventions/boot.md) |
| `SHOULD-theme-tokens` | 建议 | 主题类插件应覆盖必填 token（至少背景/文字/品牌/边框七枚） | [theme](./conventions/theme.md) |
| `OPT-cleanup` | 可选 | 注册了监听/定时器时，应有对应清理（`removeEventListener` / `clearInterval`） | 总则 |
| `WARN-undocumented-anchor` | ⚠ | 使用 `data-plugin` / `data-plugin-css` / `data-composer-input` 等未文档化锚点 | [anchors](./conventions/anchors.md) |

## 检查器的边界（重要）

它做的是**静态源码扫描**，所以：

- **注释会被剔除后再判定**（长度保持，行号仍准确）。否则"注释里写着 `__DSH_UI_BOOT__`/`maxMs`"会骗过检查——
  这个坑是本仓库自测夹具抓出来的（见 `CHANGELOG.md`）。已知边界：不识别正则字面量里的 `//`。
- **只扫描会进入 DSH 页面的运行时代码**：从 `exports["./client"]`/`main` 出发，跟随相对 import 与"指向包内真实文件的路径字符串"，排除 `test*/scripts/tools/docs/templates/preview/examples`。测试与构建工具里的写法不算违规。
- 只认文本里出现的写法。把关键逻辑藏进动态拼接、或运行时才决定的标记，检查器不会发现——
  **报告通过不等于合规**，人的自测清单仍然是主体。
- `MUST-boot-claim` / `MUST-boot-cap` / `SHOULD-skip` 依赖"全屏覆盖层"的启发式判定（`position: fixed` 且 `inset:0`/四边为 0 且 z-index 较高）。非全屏的小浮层不会被判为覆盖层。
- 命名空间判定依赖 `checks/known-namespaces.json`（本仓库实测登记的已知第三方命名空间）。新插件用了别人的前缀会报**必须**；用了全新的前缀只报**建议**（无法证明它属于谁）。
- ⚠ 类规则永远只报 warn，不阻塞。

## 自测

仓库自带两个 fixture，用来证明检查器真的能抓出问题、也不会冤枉合规包：

```powershell
node checks/self-test.mjs
```

`examples/good-plugin` 应按预期通过（无必须级违规），`examples/bad-plugin` 必须精确触发规则集里列出的那些 id（当前 6 条 must）——这是本仓库的 CI 门槛。
