#!/usr/bin/env node
/**
 * scan-anchors — 扫描已安装插件，统计 data-* 标记的"谁写、谁读"。
 *
 * 用途：发现新的冲突面，并维护 checks/known-namespaces.json。
 * 输出刻意做成可以直接贴进文档的形态。
 *
 * 用法：
 *   node checks/scan-anchors.mjs "<node_modules 目录>"            # 默认只列跨插件被读的
 *   node checks/scan-anchors.mjs "<node_modules 目录>" --all      # 列出全部
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(process.argv[2] ?? '')
const showAll = process.argv.includes('--all')
if (!root || !existsSync(root)) {
  console.error('用法: node checks/scan-anchors.mjs "<node_modules 目录>" [--all]')
  process.exit(2)
}

function packageDirs(dir) {
  const out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith('.')) continue
    const full = join(dir, e.name)
    if (e.name.startsWith('@')) {
      for (const s of readdirSync(full, { withFileTypes: true })) {
        if (s.isDirectory() && existsSync(join(full, s.name, 'package.json'))) out.push(join(full, s.name))
      }
    } else if (existsSync(join(full, 'package.json'))) out.push(full)
  }
  return out
}

function jsFiles(dir, acc = [], depth = 0) {
  if (depth > 6) return acc
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return acc }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git') continue
    const p = join(dir, e.name)
    if (e.isDirectory()) jsFiles(p, acc, depth + 1)
    else if (/\.(js|mjs|cjs)$/.test(e.name)) {
      try { if (statSync(p).size < 3_000_000) acc.push(p) } catch { /* 跳过不可读 */ }
    }
  }
  return acc
}

const writers = new Map()
const readers = new Map()
const push = (map, attr, who) => {
  if (!map.has(attr)) map.set(attr, new Set())
  map.get(attr).add(who)
}

for (const dir of packageDirs(root)) {
  const name = dir.slice(root.length + 1).replace(/\\/g, '/')
  for (const file of jsFiles(dir)) {
    let text
    try { text = readFileSync(file, 'utf8') } catch { continue }
    for (const m of text.matchAll(/setAttribute\(\s*['"](data-[a-z0-9-]+)['"]/gi)) push(writers, m[1], name)
    for (const m of text.matchAll(/dataset\.([A-Za-z][A-Za-z0-9_]*)\s*=/g)) {
      push(writers, 'data-' + m[1].replace(/[A-Z]/g, c => '-' + c.toLowerCase()), name)
    }
    for (const m of text.matchAll(/getAttribute\(\s*['"](data-[a-z0-9-]+)['"]/gi)) push(readers, m[1], name)
    for (const m of text.matchAll(/querySelector(?:All)?\(\s*['"][^'"]*\[(data-[a-z0-9-]+)/gi)) push(readers, m[1], name)
  }
}

const crossRead = []
for (const [attr, rd] of readers) {
  const wr = writers.get(attr)
  const cross = [...rd].filter(p => !(wr && wr.has(p)))
  if (cross.length) crossRead.push({ attr, cross, writers: wr ? [...wr] : [] })
}

console.log(`扫描范围：${root}`)
console.log(`标记总数：写 ${writers.size} 个，读 ${readers.size} 个\n`)
console.log('=== 被其他插件读取的标记（= 事实上的跨插件约定）===')
for (const row of crossRead.sort((a, b) => a.attr.localeCompare(b.attr))) {
  console.log(`  ${row.attr.padEnd(32)} 读方=${row.cross.join(', ')}  写方=${row.writers.join(', ') || '(未安装)'}`)
}
if (showAll) {
  console.log('\n=== 全部被写的标记 ===')
  for (const [attr, set] of [...writers].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${attr.padEnd(32)} <- ${[...set].join(', ')}`)
  }
}
console.log('\n提示：把新发现的"被跨插件读取"的标记登记到 checks/known-namespaces.json，并在 SOURCES.md 记出处。')
