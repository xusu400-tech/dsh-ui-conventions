# 发布与同步（Publishing）

本仓库同时用两种方式维护，这里写清"为什么"和"怎么做"，避免下次再花时间排查。

## 症状与根因（2026-11-12 实测）

在某台机器上 `git fetch` / `git push` / `git clone` 会挂死：一次 300 秒超时、一次 21 秒直接拒连。
但同一个网络里：

| 目标 | 结果 |
|---|---|
| `api.github.com` | 200，**0.39s** |
| `raw.githubusercontent.com` | 200，0.62s |
| `codeload.github.com` | 200，3.47s |
| `github.com`（站点页） | 200，但 **15.0s+** |
| `github.com/<owner>/<repo>.git/info/refs`（git 智能 HTTP） | 200，约 1s 直连时可用 |
| **`git`（默认 HTTP/1.1）** | **挂死 300s** |
| **`git -c http.version=HTTP/2`** | **2.3s 成功** |

结论：**不是被墙，是这条线路上 git 的 HTTP/1.1 传输会卡死**。

## 解决办法：让 git 走 HTTP/2

```powershell
cd <repo>
git config http.version HTTP/2      # 一次性写入本仓库配置
git fetch origin
git push origin main
```

如果某个环境不支持 HTTP/2（老 git / 代理），退回到**内容 API 上传**（见下）。

## 备用通道：GitHub Contents API

当 git 完全不可用时，仍可用 API 逐文件写入（`api.github.com` 稳定）：

```powershell
$fill = "protocol=https`nhost=github.com`n`n" | git credential fill
$tok  = ($fill | Select-String '^password=').Line -replace '^password=', ''
# 已有文件需要 sha；新文件不需要
$meta = curl.exe -s -H "Authorization: Bearer $tok" -H 'User-Agent: x' `
  "https://api.github.com/repos/<owner>/<repo>/contents/<path>" | ConvertFrom-Json
$body = @{ message = 'why'; content = [Convert]::ToBase64String([IO.File]::ReadAllBytes($abs)); branch = 'main' }
if ($meta.sha) { $body.sha = $meta.sha }
```

**代价**：API 上传会为**每个文件**生成一个提交，于是远端历史与本地历史分叉。
内容可以完全一致，但 `git log` 会不一样。

## 历史对齐

远端被 API 改成多提交、本地是自己的提交时，二选一：

```powershell
# A. 以远端为准（内容一致，丢弃本地提交信息）
git fetch origin
git reset --hard origin/main

# B. 以本地为准（重写远端历史；仓库独占时才用）
git push --force-with-lease origin main
```

**只允许 `--force-with-lease`**，不要用 `--force`：前者在远端被别人动过时会拒绝，后者会直接覆盖他人提交。

## 内容一致性怎么验（不依赖 git 传输）

用 API 取远端树的 blob sha，与本地 `git hash-object` 逐个比对：

```powershell
$tree = curl.exe -s -H "Authorization: Bearer $tok" -H 'User-Agent: x' `
  "https://api.github.com/repos/<owner>/<repo>/git/trees/main?recursive=1" | ConvertFrom-Json
foreach ($b in $tree.tree | Where-Object type -eq 'blob') {
  $h = git hash-object $b.path
  if ($h -ne $b.sha) { "MISMATCH $($b.path)" }
}
```

本仓库 2026-11-12 实测：**33/33 个 blob 完全一致**，差异只在提交历史形状。

## 建议的 CI

仓库自带两条门槛，可直接放进 GitHub Actions（`node checks/self-test.mjs`、
`node checks/test-reference-impl.mjs`），无外部依赖、无密钥需求。
