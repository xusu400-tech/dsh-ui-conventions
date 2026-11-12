#!/usr/bin/env node
/**
 * 检查器自身的门槛：合规样例不得报"必须"级违规，违规样例必须精确命中预期规则。
 *
 * 这个脚本存在的原因：一个只会说"通过"的检查器没有价值。夹具是它可信度的来源。
 */
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lintPackage } from './dsh-ui-lint.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

let pass = 0
let fail = 0
const check = (name, ok, extra = '') => {
  if (ok) { pass++; console.log(`  PASS  ${name}`) }
  else { fail++; console.log(`  FAIL  ${name}${extra ? '  ' + extra : ''}`) }
}
const mustRules = (result) => [...new Set(result.findings.filter(f => f.severity === 'must').map(f => f.rule))].sort()

console.log('=== fixtures ===')
for (const name of ['good-plugin', 'bad-plugin']) {
  const dir = join(ROOT, 'examples', name)
  check(`fixture 存在：${name}`, existsSync(join(dir, 'package.json')))
}

console.log('\n=== good-plugin 不应有"必须"级违规 ===')
const good = lintPackage(join(ROOT, 'examples', 'good-plugin'))
const goodMust = mustRules(good)
check('无 must 违规', goodMust.length === 0, `实际：${goodMust.join(', ')}`)
check('参与首屏协调（出现 __DSH_UI_BOOT__）', good.findings.every(f => f.rule !== 'MUST-boot-claim'))
check('未被判为未文档化锚点之外的噪声', !good.findings.some(f => f.rule === 'MUST-no-dsw-namespace'))
console.log(`   （good-plugin 全部发现：${good.findings.map(f => f.rule).join(', ') || '无'}）`)

console.log('\n=== bad-plugin 必须精确命中预期的 must 规则 ===')
const bad = lintPackage(join(ROOT, 'examples', 'bad-plugin'))
const badMust = mustRules(bad)
const EXPECTED = [
  'MUST-boot-cap',
  'MUST-boot-claim',
  'MUST-namespace-own',
  'MUST-no-dsw-namespace',
  'MUST-no-host-global-clobber',
  'MUST-no-host-marker-write',
].sort()
check('must 规则集合完全一致', JSON.stringify(badMust) === JSON.stringify(EXPECTED),
  `\n        期望：${EXPECTED.join(', ')}\n        实际：${badMust.join(', ')}`)
for (const rule of EXPECTED) {
  check(`命中 ${rule}`, badMust.includes(rule))
}
check('同时报出全屏但无跳过（建议级）', bad.findings.some(f => f.rule === 'SHOULD-skip'))
check('同时报出未标 data-plugin（建议级）', bad.findings.some(f => f.rule === 'SHOULD-plugin-anchor'))
check('同时报出缺清理（可选级）', bad.findings.some(f => f.rule === 'OPT-cleanup'))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
