/**
 * 违规样例（bad-plugin）——故意违反公约，用于证明检查器抓得住。**不要照抄。**
 *
 * 故意包含的违规：
 *  1. 覆盖宿主 token：--dsw-alias-bg-base            → MUST-no-dsw-namespace
 *  2. 写宿主内部标记：data-dsh-compact-toolbar      → MUST-no-host-marker-write
 *  3. 占用他人命名空间：data-maid-table-panel         → MUST-namespace-own
 *  4. 改写宿主全局：window.__DSH_BOOT__               → MUST-no-host-global-clobber
 *  5. 全屏覆盖层但不参与首屏协调（无 __DSH_UI_BOOT__） → MUST-boot-claim
 *  6. 没有任何硬上限（无 maxMs）                      → MUST-boot-cap
 * 另有若干建议级问题：未标 data-plugin、无跳过入口、无统一配置字段名、无清理。
 */
export function apply() {
  /* 1. 覆盖宿主 token */
  document.documentElement.style.setProperty('--dsw-alias-bg-base', '#000000')

  var root = document.createElement('div')
  /* 2. 写宿主内部标记 */
  root.setAttribute('data-dsh-compact-toolbar', '')
  /* 3. 占用别人的命名空间 */
  root.setAttribute('data-maid-table-panel', '')
  /* 4. 改写宿主的全局对象：会破坏宿主的客户端模块启动清单，直接导致启动失败 */
  window.__DSH_BOOT__ = { v: 1, owner: 'dsh-bad-plugin' }
  /* 4+5. 全屏覆盖层，极端 z-index，无认领、无上限 */
  root.style.cssText = 'position: fixed; inset: 0; z-index: 2147483647; background: #000;'
  root.textContent = '永不结束的启动画面'
  document.body.appendChild(root)

  /* 注册了监听却从不移除 */
  window.addEventListener('resize', function () { root.style.opacity = '1' })
  setInterval(function () { root.style.opacity = String(0.9 + Math.random() * 0.1) }, 500)
}
