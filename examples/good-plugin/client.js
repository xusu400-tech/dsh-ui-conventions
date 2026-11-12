/**
 * 合规样例（good-plugin）：按 DSH 首屏公约 v1 实现一个开机动画。
 *
 * 满足检查器与公约要求的关键点：
 *  - 认领 / 释放（__DSH_UI_BOOT__ + dsh-ui-boot:claim / dsh-ui-boot:release）
 *  - 硬上限 maxMs、宽限 graceMs、等待上限 waitCapMs
 *  - 可跳过（click / keydown），失败与超时都释放
 *  - 自己的根元素标 data-plugin（所有权标记），不写宿主内部标记
 *  - 监听器与定时器都有对应的清理
 */
var PKG = 'dsh-good-boot-plugin'

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
    var next = { v: 1, owner: id, priority: priority, since: Date.now(), maxMs: maxMs }
    write(next)
    try { window.dispatchEvent(new CustomEvent('dsh-ui-boot:claim', { detail: { id: id, priority: priority, maxMs: maxMs } })) } catch (e) {}
    return next
  }
  function release(reason) {
    var cur = snapshot()
    if (!cur || cur.owner !== id) return false
    write({ v: 1, owner: null, priority: null, since: null, maxMs: null })
    try { window.dispatchEvent(new CustomEvent('dsh-ui-boot:release', { detail: { id: id, reason: reason || 'ended' } })) } catch (e) {}
    return true
  }
  function whenFree(onGo) {
    var startedAt = Date.now()
    var done = false
    function go(why) { if (done) return; done = true; try { window.removeEventListener('dsh-ui-boot:release', onRelease) } catch (e) {} onGo(why) }
    function onRelease() { go('release') }
    try { window.addEventListener('dsh-ui-boot:release', onRelease) } catch (e) {}
    var timer = setInterval(function () {
      var s = snapshot()
      if (!s || !s.owner) return go('free')
      if (s.owner === id) return go('self')
      if (Date.now() - s.since > (s.maxMs || 0) + slackMs) return go('took-over-stale')
      if (Date.now() - startedAt > waitCapMs) return go('wait-cap')
    }, 120)
    setTimeout(function () { if (!snapshot()) go('grace-expired') }, graceMs)
    return function cancel() { clearInterval(timer); try { window.removeEventListener('dsh-ui-boot:release', onRelease) } catch (e) {} }
  }
  return { claim: claim, release: release, whenFree: whenFree, snapshot: snapshot }
}

export function apply() {
  /* 统一配置字段名（公约 boot.md §4）：boot.priority / maxMs / waitCapMs / graceMs */
  var config = {
    boot: { enabled: true, priority: 100, maxMs: 20000, waitCapMs: 120000, graceMs: 4000, skippable: true },
  }
  var boot = createBootCoordination({
    id: PKG,
    priority: config.boot.priority,
    maxMs: config.boot.maxMs,
    waitCapMs: config.boot.waitCapMs,
    graceMs: config.boot.graceMs,
  })
  var root = null
  var capTimer = null

  function onSkip() { teardown('skipped') }
  function onKeydown(e) { if (e.key === 'Escape' || e.key === ' ') teardown('skipped') }

  function teardown(reason) {
    if (capTimer !== null) { clearTimeout(capTimer); capTimer = null }
    if (root) {
      root.style.opacity = '0'                 /* 先开始淡出，再释放（交接无空窗） */
      var node = root
      root = null
      setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node) }, 600)
    }
    window.removeEventListener('click', onSkip)
    window.removeEventListener('keydown', onKeydown)
    boot.release(reason)
  }

  root = document.createElement('div')
  root.setAttribute('data-plugin', PKG)          /* 所有权标记：标自己的节点 */
  root.style.cssText = 'position: fixed; inset: 0; z-index: 2147483000; background: #06080c; cursor: pointer;'
  root.textContent = '正在启动…（点击跳过）'
  document.body.appendChild(root)

  window.addEventListener('click', onSkip)
  window.addEventListener('keydown', onKeydown)
  capTimer = setTimeout(function () { teardown('timeout') }, 20000)   /* 硬上限 */

  /* 素材失败时同样释放：绝不黑屏 */
  Promise.resolve().then(function () { /* 模拟素材加载 */ }).catch(function () { teardown('failed') })
}
