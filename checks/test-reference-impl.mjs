#!/usr/bin/env node
/**
 * 验证 conventions/boot.md 里的参考实现。
 *
 * 关键：代码是**从文档里按标记抽取**的，所以"测过的"就是"文档里的"——文档和实现不会漂移。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DOC = join(resolve(HERE, '..'), 'conventions', 'boot.md')
const MARKER = '/** DSH 首屏公约 v1 的最小实现'
const IMPL = join(process.env.TEMP ?? '/tmp', 'dsh-boot-convention-impl.mjs')

const md = readFileSync(DOC, 'utf8')
const start = md.indexOf('```js\n' + MARKER)
if (start < 0) { console.error('FAIL: boot.md 里找不到参考实现代码块'); process.exit(1) }
const codeStart = md.indexOf('\n', start + 5) + 1
const codeEnd = md.indexOf('```', codeStart)
if (codeEnd < 0) { console.error('FAIL: 参考实现代码块没有结束标记'); process.exit(1) }
const code = md.slice(codeStart, codeEnd)
console.log(`从 boot.md 抽取参考实现：${code.split('\n').length} 行 / ${code.length} 字符`)
writeFileSync(IMPL, code + '\nexport { createBootCoordination }\n', 'utf8')

/* ── 极简 DOM / window 桩 ─────────────────────────────────────────── */
const listeners = new Map()
const attrs = new Map()
globalThis.window = {
  __DSH_BOOT__: undefined,
  dispatchEvent(event) { (listeners.get(event.type) || []).forEach(fn => fn(event)); return true },
  addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn) },
  removeEventListener(type, fn) { const l = listeners.get(type) || []; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1) },
}
globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init && init.detail } }
globalThis.document = {
  documentElement: {
    setAttribute: (k, v) => attrs.set(k, v),
    removeAttribute: (k) => attrs.delete(k),
    getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
  },
}

const { createBootCoordination } = await import(pathToFileURL(IMPL).href)

let pass = 0
let fail = 0
const check = (name, ok, extra = '') => {
  if (ok) { pass++; console.log(`  PASS  ${name}`) }
  else { fail++; console.log(`  FAIL  ${name}${extra ? '  ' + extra : ''}`) }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

{
  delete globalThis.window.__DSH_BOOT__
  const a = createBootCoordination({ id: 'A', graceMs: 60, waitCapMs: 500 })
  const why = await new Promise(res => a.whenFree(res))
  check('宽限期内无人认领 -> 自行开播', why === 'grace-expired', `why=${why}`)
}
{
  delete globalThis.window.__DSH_BOOT__
  const a = createBootCoordination({ id: 'A', priority: 100, maxMs: 1000 })
  a.claim()
  check('认领后快照 owner=A', window.__DSH_BOOT__.owner === 'A')
  check('认领后 html[data-dsh-boot]=A', attrs.get('data-dsh-boot') === 'A')
  check('release 第一次返回 true', a.release('ended') === true)
  check('release 第二次返回 false（幂等）', a.release('ended') === false)
  check('释放后 owner=null', window.__DSH_BOOT__.owner === null)
  check('释放后属性被移除', !attrs.has('data-dsh-boot'))
}
{
  delete globalThis.window.__DSH_BOOT__
  const a = createBootCoordination({ id: 'A', priority: 100, maxMs: 5000 })
  const b = createBootCoordination({ id: 'B', priority: 200, graceMs: 10000, waitCapMs: 5000 })
  a.claim()
  const bWhy = new Promise(res => b.whenFree(res))
  await sleep(150)
  check('A 在播时 B 仍在等待', window.__DSH_BOOT__.owner === 'A')
  a.release('skipped')
  const why = await bWhy
  check("A 释放后 B 由 'release' 唤醒", why === 'release', `why=${why}`)
}
{
  delete globalThis.window.__DSH_BOOT__
  const a = createBootCoordination({ id: 'A', priority: 100, maxMs: 600000 })
  const b = createBootCoordination({ id: 'B', priority: 200, graceMs: 10000, waitCapMs: 250 })
  a.claim()
  const t0 = Date.now()
  const why = await new Promise(res => b.whenFree(res))
  check("等待到达 waitCapMs -> 'wait-cap'", why === 'wait-cap', `why=${why}`)
  check('等待时长接近 waitCapMs', Date.now() - t0 >= 230 && Date.now() - t0 < 900, `${Date.now() - t0}ms`)
}
{
  delete globalThis.window.__DSH_BOOT__
  const a = createBootCoordination({ id: 'A', priority: 100, maxMs: 200 })
  const b = createBootCoordination({ id: 'B', priority: 200, graceMs: 10000, waitCapMs: 10000 })
  a.claim()
  const t0 = Date.now()
  const why = await new Promise(res => b.whenFree(res))
  const dt = Date.now() - t0
  check("台上者过期 -> 'took-over-stale'", why === 'took-over-stale', `why=${why}`)
  check('接棒发生在 maxMs+slack 之后', dt >= 2100 && dt < 3600, `${dt}ms`)
}
{
  delete globalThis.window.__DSH_BOOT__
  const a = createBootCoordination({ id: 'A' })
  a.claim()
  const why = await new Promise(res => a.whenFree(res))
  check("自己已是 owner -> 'self'", why === 'self', `why=${why}`)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
