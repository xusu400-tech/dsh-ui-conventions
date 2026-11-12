#!/usr/bin/env node
/**
 * dsh-ui-lint — 按 DSH UI 插件公约检查一个（或一批）插件包。
 *
 * 扫描口径（重要）：只检查**会进入 DSH 页面的运行时代码**，不检查测试/脚本/构建工具：
 *   起点 = package.json 的 exports["./client"] / exports["."] / main
 *   展开 = 相对 import/require，以及"指向包内真实文件的路径字符串"（宿主用路由注入的客户端资源常这么写）
 *   附带 = 与上面文件同目录的 .css
 *   排除 = test/tests/scripts/tools/docs/templates/preview/examples 等开发目录
 * 这是启发式：单文件打包、动态拼接路径都可能漏，故"通过"不等于合规（见 MACHINE-CHECKABLE.md）。
 *
 * 用法：
 *   node checks/dsh-ui-lint.mjs <插件目录 | 多包目录> [--json] [--no-fail] [--batch] [--all-files]
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REGISTRY = JSON.parse(readFileSync(join(HERE, 'known-namespaces.json'), 'utf8'))
const SEVERITY_ORDER = { must: 0, should: 1, opt: 2, warn: 3 }
const DEV_DIR_RE = /(^|[\\/])(test|tests|__tests__|scripts|tools|docs|templates|preview|examples|bench|fixtures)([\\/]|$)/i
const MAX_FILE_BYTES = 3_000_000

/** 去掉 JS 注释（长度保持）；CSS 只去块注释。 */
function stripComments(text, isCss = false) {
  const out = new Array(text.length)
  let quote = null
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    const d = text[i + 1]
    if (quote !== null) {
      out[i] = c
      if (c === '\\') { i++; if (i < text.length) out[i] = text[i]; continue }
      if (c === quote) quote = null
      continue
    }
    if (!isCss && (c === '"' || c === "'" || c === '`')) { quote = c; out[i] = c; continue }
    if (!isCss && c === '/' && d === '/') {
      while (i < text.length && text[i] !== '\n') { out[i] = ' '; i++ }
      if (i < text.length) out[i] = '\n'
      continue
    }
    if (c === '/' && d === '*') {
      out[i] = ' '; out[i + 1] = ' '; i += 2
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
        out[i] = text[i] === '\n' ? '\n' : ' '
        i++
      }
      if (i < text.length) { out[i] = ' '; out[i + 1] = ' '; i++ }
      continue
    }
    out[i] = c
  }
  return out.join('')
}

const pickPath = value => (typeof value === 'string'
  ? value
  : value && typeof value === 'object'
    ? (value.default ?? value.import ?? value.require ?? value.node)
    : undefined)

/** 入口文件（相对包根）。 */
function entryFiles(pkg) {
  const raw = [
    pickPath(pkg.exports?.['./client']),
    pickPath(pkg.exports?.['.']),
    pkg.main,
    pkg.browser,
    pkg.module,
  ].filter(v => typeof v === 'string')
  const out = []
  for (const p of raw) {
    const clean = p.replace(/^\.\//, '')
    if (!out.includes(clean)) out.push(clean)
  }
  return out
}

/** 从入口出发收集运行时代码 + 同目录 CSS。 */
function collectSources(pkgDir, entries) {
  const seen = new Set()
  const out = []
  const queue = [...entries]

  const push = rel => {
    const abs = join(pkgDir, rel)
    if (seen.has(abs) || !existsSync(abs)) return
    let st
    try { st = statSync(abs) } catch { return }
    if (!st.isFile() || st.size > MAX_FILE_BYTES) return
    if (DEV_DIR_RE.test(rel)) return
    seen.add(abs)
    let text
    try { text = readFileSync(abs, 'utf8') } catch { return }
    out.push({ path: abs, rel: rel.replace(/\\/g, '/'), text, isCss: /\.css$/i.test(rel) })
    return abs
  }

  while (queue.length > 0) {
    const rel = queue.shift()
    const before = out.length
    const abs = push(rel)
    if (!abs || out.length === before) continue
    const src = out[out.length - 1]
    if (src.isCss) continue
    const code = stripComments(src.text)
    /* 1. 相对 import / require */
    for (const m of code.matchAll(/(?:from|import|require)\s*\(?\s*['"](\.[^'"]+)['"]/g)) {
      let target = resolve(dirname(abs), m[1])
      if (!existsSync(target)) {
        for (const ext of ['.js', '.mjs', '.cjs', '.json', '/index.js']) {
          if (existsSync(target + ext)) { target += ext; break }
        }
      }
      const r = relative(pkgDir, target).replace(/\\/g, '/')
      if (!r.startsWith('..') && existsSync(target)) queue.push(r)
    }
    /* 2. 指向包内真实文件的路径字符串（宿主路由注入的客户端资源） */
    for (const m of code.matchAll(/['"]([A-Za-z0-9_./-]+\.(?:js|mjs|cjs|css))['"]/g)) {
      const candidate = resolve(dirname(abs), m[1])
      if (!existsSync(candidate)) continue
      const r = relative(pkgDir, candidate).replace(/\\/g, '/')
      if (!r.startsWith('..')) queue.push(r)
    }
    /* 3. 只提到"目录名"的情形（宿主按路由注入整个目录的资源，例如 'runtime'）：
          把包内同名且存在的目录下的 .js/.css 补进来 */
    for (const m of code.matchAll(/['"]([A-Za-z0-9_-]+)['"]/g)) {
      const dir = join(pkgDir, m[1])
      if (!existsSync(dir)) continue
      let st
      try { st = statSync(dir) } catch { continue }
      if (!st.isDirectory() || DEV_DIR_RE.test(m[1] + '/')) continue
      let children
      try { children = readdirSync(dir) } catch { continue }
      for (const f of children) {
        if (!/\.(js|mjs|cjs|css)$/i.test(f)) continue
        queue.push(`${m[1]}/${f}`)
      }
    }
  }

  /* 3. 同目录 CSS（打包产物常把样式与入口放同层） */
  for (const src of [...out]) {
    let entries2
    try { entries2 = readdirSync(dirname(src.path)) } catch { continue }
    for (const f of entries2) {
      if (!/\.css$/i.test(f)) continue
      const rel = relative(pkgDir, join(dirname(src.path), f)).replace(/\\/g, '/')
      push(rel)
    }
  }
  return out
}

function ownPrefixes(pkgName) {
  const set = new Set()
  if (!pkgName) return set
  set.add(pkgName.toLowerCase())
  const bare = pkgName.includes('/') ? pkgName.split('/').pop() : pkgName
  set.add(bare.toLowerCase())
  set.add(bare.replace(/^dsh-/, '').replace(/^plugin-/, '').toLowerCase())
  for (const [prefix, owner] of Object.entries(REGISTRY.thirdParty ?? {})) {
    if (owner === pkgName) set.add(prefix.toLowerCase())
  }
  return set
}

const namespaceOf = attr => {
  const m = /^data-([a-z0-9]+)(-|$)/.exec(attr)
  return m ? m[1] : null
}

const ROOT_RECEIVER_RE = /(?:documentElement|document\.body|:root(?![\w-])|(?:^|[^.\w])html(?![\w-])|(?:^|[^.\w])body(?![\w-]))/

function looksLikeFullscreenOverlay(code) {
  const fixed = /position\s*:\s*fixed/.test(code)
  if (!fixed) return false
  const covers = /inset\s*:\s*0\b/.test(code)
    || /top\s*:\s*0\b[\s\S]{0,160}?left\s*:\s*0\b/.test(code)
    || /width\s*:\s*100(?:vw|%)[\s\S]{0,160}?height\s*:\s*100(?:vh|%)/.test(code)
  const highZ = /z-index\s*:\s*(?:[1-9]\d{3,}|2147\d+)/.test(code)
  return covers || highZ
}

function lineOf(text, index) {
  let line = 1
  for (let i = 0; i < index && i < text.length; i++) if (text[i] === '\n') line++
  return line
}

/** 该写入是否是"全局"（作用在 html/body/:root 上）。 */
function isGlobalWrite(code, index) {
  const window = code.slice(Math.max(0, index - 220), index + 120)
  return ROOT_RECEIVER_RE.test(window)
}

export function lintPackage(pkgDir) {
  const findings = []
  const seen = new Set()
  const add = (rule, severity, message, file, line) => {
    const key = `${rule}|${message}|${file ?? ''}|${line ?? ''}`
    if (seen.has(key)) return
    seen.add(key)
    findings.push({ rule, severity, message, file, line })
  }

  const pkgPath = join(pkgDir, 'package.json')
  if (!existsSync(pkgPath)) {
    add('MUST-package-manifest', 'must', '目录里没有 package.json')
    return { name: basename(pkgDir), findings }
  }
  let pkg
  try { pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) } catch (error) {
    add('MUST-package-manifest', 'must', `package.json 不是合法 JSON：${error.message}`, 'package.json')
    return { name: basename(pkgDir), findings }
  }
  const name = pkg.name ?? basename(pkgDir)
  const entries = entryFiles(pkg)
  const sources = collectSources(pkgDir, entries)
  if (sources.length === 0) {
    add('SHOULD-entry-unresolved', 'should', `找不到可扫描的运行时入口（entries=${entries.join(', ') || '无'}）`)
  }
  const allText = sources.map(s => s.text).join('\n')
  /* 包级判定用"剔除注释后"的文本，否则注释里的字样会骗过参与度检查 */
  const allCode = sources.map(s => stripComments(s.text, s.isCss)).join('\n')
  const own = ownPrefixes(name)

  // ── MUST-client-manifest ────────────────────────────────────────────
  if (pkg.dsh?.client) {
    if (typeof pkg.dsh.client.platform !== 'string') {
      add('MUST-client-manifest', 'must', 'dsh.client 缺少 platform（应为 "web"）', 'package.json')
    }
    const decl = pkg.exports?.['./client']
    if (decl === undefined) {
      add('MUST-client-manifest', 'must', 'dsh.client 存在但 exports["./client"] 未声明', 'package.json')
    } else {
      const rel = pickPath(decl)
      if (rel && !existsSync(join(pkgDir, rel))) {
        add('MUST-client-manifest', 'must', `exports["./client"] 指向的文件不存在：${rel}`, 'package.json')
      }
    }
  }

  // ── 首屏协调按"包"判定：覆盖层可能定义在 .css 里，而协调代码在 .js 里 ──
  const pkgParticipates = /__DSH_BOOT__/.test(allCode) || /dsh:boot-(claim|release)/.test(allCode)
  const pkgHasCap = /maxMs/.test(allCode)
  /* 统一字段名：只要出现其中两个以上，就认为按公约命名了（插件里的写法可能是 bootCfg.maxMs / C.boot.maxMs） */
  const namingHits = ['priority', 'maxMs', 'waitCapMs', 'graceMs']
    .filter(k => new RegExp(`\\b${k}\\b`).test(allCode))

  for (const src of sources) {
    const code = stripComments(src.text, src.isCss)

    // ── MUST-no-dsw-namespace：只禁止"全局"覆盖宿主 token ────────────
    for (const m of code.matchAll(/setProperty\(\s*['"](--dsw-[a-z0-9-]+)['"]/g)) {
      if (isGlobalWrite(code, m.index)) {
        add('MUST-no-dsw-namespace', 'must', `在 html/body 上覆盖宿主 token：${m[1]}`, src.rel, lineOf(code, m.index))
      } else {
        add('OPT-scoped-token', 'opt', `在自建子树内覆盖宿主 token：${m[1]}（确认作用域限于自己的节点）`, src.rel, lineOf(code, m.index))
      }
    }
    /* CSS 声明：只有选择器指向 :root/html/body 才算覆盖全局 */
    for (const block of code.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = block[1].trim()
      const body = block[2]
      if (!/--dsw-[a-z0-9-]+\s*:/.test(body)) continue
      if (!/(^|,)\s*(:root|html|body)\s*(,|$)/.test(selector)) continue
      add('MUST-no-dsw-namespace', 'must', `在 ${selector.slice(0, 40)} 上定义宿主 token`, src.rel, lineOf(code, block.index))
    }

    // ── MUST-no-host-marker-write ────────────────────────────────────
    const internal = (REGISTRY.hostInternal ?? []).join('|')
    for (const m of code.matchAll(new RegExp(`setAttribute\\(\\s*['"](${internal})['"]`, 'gi'))) {
      add('MUST-no-host-marker-write', 'must', `写入宿主内部标记：${m[1]}`, src.rel, lineOf(code, m.index))
    }
    for (const m of code.matchAll(/removeAttribute\(\s*['"](data-plugin|data-plugin-css|data-dsh-compact-toolbar|data-dsh-compact-valid)['"]/gi)) {
      add('MUST-no-host-marker-write', 'must', `删除宿主标记：${m[1]}`, src.rel, lineOf(code, m.index))
    }
    if (/dataset\.pluginCss\s*=/.test(code)) {
      add('MUST-no-host-marker-write', 'must', '写入宿主内部标记：dataset.pluginCss', src.rel)
    }

    // ── MUST-namespace-own：占用别人的命名空间 / 裸名 ────────────────
    const writes = []
    for (const m of code.matchAll(/setAttribute\(\s*['"](data-[a-z0-9-]+)['"]/gi)) writes.push({ attr: m[1], index: m.index })
    for (const m of code.matchAll(/dataset\.([A-Za-z][A-Za-z0-9_]*)\s*=/g)) {
      writes.push({ attr: 'data-' + m[1].replace(/[A-Z]/g, c => '-' + c.toLowerCase()), index: m.index })
    }
    for (const { attr, index } of writes) {
      if ((REGISTRY.hostInternal ?? []).includes(attr)) continue
      if ((REGISTRY.ownershipMarker ?? []).includes(attr)) continue
      if (attr.startsWith('data-dsh-')) continue
      const ns = namespaceOf(attr)
      if (ns === null) continue
      const owner = REGISTRY.thirdParty?.[ns]
      if (owner && owner !== name && !own.has(ns)) {
        add('MUST-namespace-own', 'must', `占用了其他插件的命名空间：${attr}（属于 ${owner}）`, src.rel, lineOf(code, index))
      } else if (!owner && REGISTRY.bareNamesSeenInTheWild.includes(attr)) {
        add('MUST-namespace-own', 'must', `使用了生态中已被占用的裸名：${attr}`, src.rel, lineOf(code, index))
      } else if (!owner && !own.has(ns) && isGlobalWrite(code, index)) {
        /* 只在"挂到 html/body 上"时建议改前缀；元素局部状态不算问题 */
        add('SHOULD-own-prefix', 'should', `全局标记的前缀与包名不一致：${attr}`, src.rel, lineOf(code, index))
      }
    }

    // ── 首屏相关 ─────────────────────────────────────────────────────
    if (looksLikeFullscreenOverlay(code)) {
      if (!pkgParticipates) {
        add('MUST-boot-claim', 'must', '存在全屏覆盖层但未参与首屏协调（缺 __DSH_BOOT__ / dsh:boot-*）', src.rel)
      }
      if (!pkgHasCap) {
        add('MUST-boot-cap', 'must', '存在全屏覆盖层但没有硬上限（缺 maxMs）', src.rel)
      }
      if (!/setAttribute\(\s*['"]data-plugin['"]/.test(allCode)) {
        add('SHOULD-plugin-anchor', 'should', '全屏覆盖层未标 data-plugin（建议标自己的包名）', src.rel)
      }
      if (!/skip/i.test(allCode) || !/(click|keydown|keyup)/i.test(allCode)) {
        add('SHOULD-skip', 'should', '全屏覆盖层未发现跳过入口（点击/按键）', src.rel)
      }
      if (namingHits.length < 2) {
        add('SHOULD-config-naming', 'should', '首屏配置未使用统一字段名（boot.priority/maxMs/waitCapMs/graceMs）', src.rel)
      }
    }

    // ── OPT-cleanup ─────────────────────────────────────────────────
    if (/addEventListener\(/.test(code) && !/removeEventListener\(/.test(code)) {
      add('OPT-cleanup', 'opt', '有 addEventListener 但未见 removeEventListener（确认是否需要清理）', src.rel)
    }

    // ── WARN-undocumented-anchor ────────────────────────────────────
    const anchors = ['data-plugin', 'data-plugin-css', 'data-composer-input']
      .filter(a => new RegExp(`(getAttribute|querySelector|closest)\\(?[^\\n]{0,100}${a}`).test(code))
    if (anchors.length > 0) {
      add('WARN-undocumented-anchor', 'warn', `使用了未文档化锚点：${[...new Set(anchors)].join(', ')}（需三级兜底）`, src.rel)
    }
  }

  // ── SHOULD-theme-tokens ───────────────────────────────────────────
  if (/theme|skin|token|配色|主题/i.test(name) || /--dsw-alias-/.test(allText)) {
    const required = ['--dsw-alias-bg-base', '--dsw-alias-bg-layer-1', '--dsw-alias-label-primary',
      '--dsw-alias-label-secondary', '--dsw-alias-brand-primary', '--dsw-alias-border-l1', '--dsw-alias-border-l2']
    const missing = required.filter(t => !allText.includes(t))
    if (missing.length > 0) {
      add('SHOULD-theme-tokens', 'should', `主题类插件未覆盖必填 token：${missing.join(', ')}`)
    }
  }

  return { name, findings }
}

function formatFindings(result) {
  const label = { must: '必须', should: '建议', opt: '可选', warn: '⚠' }
  return [...result.findings]
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .map(f => {
      const where = f.file ? `${f.file}${f.line ? ':' + f.line : ''}` : '-'
      return `  [${label[f.severity]}] ${f.rule.padEnd(26)} ${f.message}  (${where})`
    })
}

function listPackages(root) {
  const out = []
  for (const e of readdirSync(root, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith('.')) continue
    const full = join(root, e.name)
    if (e.name.startsWith('@')) {
      for (const s of readdirSync(full, { withFileTypes: true })) {
        if (s.isDirectory() && existsSync(join(full, s.name, 'package.json'))) out.push(join(full, s.name))
      }
    } else if (existsSync(join(full, 'package.json'))) out.push(full)
  }
  return out
}

function main(argv) {
  const args = argv.slice(2)
  const json = args.includes('--json')
  const noFail = args.includes('--no-fail')
  const batch = args.includes('--batch')
  const target = args.find(a => !a.startsWith('--'))
  if (!target) {
    console.error('用法: node checks/dsh-ui-lint.mjs <插件目录 | 多包目录> [--json] [--no-fail] [--batch]')
    process.exit(2)
  }
  const root = resolve(target)
  if (!existsSync(root)) {
    console.error(`路径不存在: ${root}`)
    process.exit(2)
  }
  const isBatch = batch || !existsSync(join(root, 'package.json'))
  const packages = isBatch ? listPackages(root) : [root]
  const results = packages.map(lintPackage)
  const all = results.flatMap(r => r.findings)
  const mustCount = all.filter(f => f.severity === 'must').length

  if (json) {
    console.log(JSON.stringify({ target: root, mustCount, results }, null, 2))
  } else {
    console.log(`dsh-ui-lint · ${packages.length} 个包 · 必须级违规 ${mustCount} 条（只扫描运行时入口图）`)
    for (const r of results) {
      if (r.findings.length === 0) { console.log(`\n${r.name}  ✓ 无发现`); continue }
      const counts = r.findings.reduce((acc, f) => { acc[f.severity] = (acc[f.severity] ?? 0) + 1; return acc }, {})
      const tags = ['must', 'should', 'opt', 'warn'].filter(k => counts[k]).map(k => `${k}:${counts[k]}`).join(' ')
      console.log(`\n${r.name}  ${tags}`)
      formatFindings(r).forEach(l => console.log(l))
    }
  }
  process.exit(noFail ? 0 : mustCount > 0 ? 1 : 0)
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main(process.argv)
