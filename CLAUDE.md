# CLAUDE.md - get_frontend

URLを指定してHTML/CSS/JS/画像を自動取得するRust製CLIツール。SPA対応のヘッドレスブラウザモードあり。

## 主要コマンド

```bash
# ビルド
cargo build --release

# 基本実行（フォルダ出力 + 画像ダウンロード）
cargo run --release -- --url <URL> --folder ./output --download-images

# JS実行後のDOM取得（SPA対応）
cargo run --release -- --url <URL> --folder ./output --download-images --render

# JSON出力
cargo run --release -- --url <URL> --output result.json

# スタンドアロンHTML出力
cargo run --release -- --url <URL> --standalone --output page.html
```

## コマンドラインオプション

| オプション | 説明 |
|-----------|------|
| `--url`, `-u` | 取得対象URL（必須） |
| `--folder` | フォルダ構成で出力（推奨） |
| `--download-images` | 画像をローカル保存 |
| `--render` | ヘッドレスChromiumでJS実行 |
| `--output`, `-o` | 出力ファイルパス |
| `--standalone` | CSS/画像埋め込みの単一HTML |
| `--timeout` | タイムアウト秒数（デフォルト30） |
| `--verbose`, `-v` | 詳細ログ |

## ディレクトリ構造

```
get_frontend/
├── src/
│   ├── main.rs          # CLIエントリーポイント
│   ├── lib.rs           # ライブラリエクスポート
│   ├── config.rs        # 設定管理
│   ├── errors.rs        # エラー定義
│   ├── resolver.rs      # URL解決
│   ├── http/
│   │   ├── mod.rs
│   │   ├── client.rs    # HTTPクライアント構築
│   │   └── fetcher.rs   # HTML取得
│   ├── extract/
│   │   ├── mod.rs       # リソース抽出メイン
│   │   ├── html.rs      # HTML解析
│   │   ├── css.rs       # CSS解析（@import, url()）
│   │   └── js.rs        # JS抽出
│   ├── render/
│   │   ├── mod.rs
│   │   ├── browser.rs   # Chromiumヘッドレス制御
│   │   └── network.rs   # ネットワーク監視
│   └── output/
│       ├── mod.rs
│       ├── folder.rs    # フォルダ出力
│       ├── standalone.rs # スタンドアロンHTML
│       └── json.rs      # JSON出力
├── output/              # デフォルト出力先
├── .claude/
│   └── commands/
│       ├── fetch.md           # /fetch スキル定義（通常取得）
│       ├── fetch-spa.md       # /fetch-spa スキル定義（SPA・動的サイト）
│       ├── fetch-standalone.md # /fetch-standalone スキル定義（単一HTML）
│       └── fetch-json.md      # /fetch-json スキル定義（JSON出力）
└── Cargo.toml
```

## 出力フォルダ構造

`--folder ./output` 実行時の出力:

```
output/
└── {ドメイン名}/
    ├── index.html       # 書き換え済みHTML
    ├── css/
    │   ├── style_1.css  # 外部CSS
    │   └── inline.css   # インラインCSS統合
    ├── js/
    │   ├── script_1.js  # 外部JS
    │   └── inline.js    # インラインJS統合
    └── images/
        └── img_1.png    # ダウンロード画像
```

## Claude Codeとしての振る舞い

### スキル選択ガイド

ユーザーの要望に応じて適切なスキルを選択する:

| ユーザーの要望 | 使用スキル |
|---------------|-----------|
| 通常の取得・URLのみ指定 | /fetch |
| SPA・動的サイト・JS実行後 | /fetch-spa |
| 単一HTMLファイル・オフライン用 | /fetch-standalone |
| JSON形式・構造化データ | /fetch-json |

### URLを渡されたら `/fetch` スキルを使用

ユーザーがURLを渡して「取得して」「フェッチして」「ダウンロードして」等と依頼した場合:

1. **即座に `/fetch` スキルを実行**
   ```
   /fetch <URL>
   ```

2. スキルが以下を自動実行:
   ```bash
   cargo run --release -- --url "<URL>" --folder ./output --download-images
   ```

3. **完了後、保存先パスを報告**
   ```
   保存完了: output/{ドメイン名}/
   - index.html
   - css/
   - js/
   - images/
   ```

### 出力先ルール

- 出力先は常に `./output` フォルダを使用
- ドメイン名ごとにサブフォルダが自動作成される
- 既存ファイルは上書きされる

### SPAページの場合

JavaScriptで動的に生成されるページ（React, Vue等）は `--render` オプションが必要:

```bash
cargo run --release -- --url <URL> --folder ./output --download-images --render
```

ユーザーが「SPAです」「Reactサイトです」と言った場合は `--render` を追加。

## よくある操作パターン

### 1. 通常のWebページ取得

```bash
cargo run --release -- --url "https://example.com" --folder ./output --download-images
```

### 2. SPA/動的ページ取得

```bash
cargo run --release -- --url "https://spa-site.com" --folder ./output --download-images --render
```

### 3. 単一HTMLファイルとして保存

```bash
cargo run --release -- --url "https://example.com" --standalone --output page.html
```

### 4. JSON形式でメタデータ含めて保存

```bash
cargo run --release -- --url "https://example.com" --output snapshot.json
```

### 5. デバッグ（詳細ログ付き）

```bash
cargo run --release -- --url "https://example.com" --folder ./output --download-images -v
```

## 制限事項

- 最大HTMLサイズ: 5MB
- 最大画像サイズ: 10MB
- 最大リダイレクト: 10回
- `--render` 使用時はChrome/Chromiumが必要
- 認証が必要なページは未対応
- `data:`, `javascript:`, `mailto:` URLはスキップ

## エージェント自動化フレームワーク

### 概要

Claude Code（オーケストレーター）と Codex CLI を連携させ、フェーズ単位（test→impl→review→fix）で自動反復開発を実現。

```
  ┌────────────────┐                     ┌────────────────┐
  │    Claude      │ ──────実装────────► │     Codex      │
  │  (Orchestrator)│                     │   (Reviewer)   │
  │                │ ◄────レビュー────── │                │
  └────────────────┘                     └────────────────┘
```

### 役割とエージェントの対応

| 役割 | エージェント | Wrapper | 用途 |
|-----|------------|---------|------|
| **Coder** | Claude/Codex | `codex-wrapper-high.sh` | 実装・修正 |
| **Reviewer** | Codex | `codex-wrapper-xhigh.sh` | レビュー・品質検証 |
| **Orchestrator** | Claude Code | - | 統括・計画 |

### auto_orchestrate.sh の使い方

```bash
# 標準実行
./.claude/commands/auto_orchestrate.sh \
  --plan .agent/active/plan_*.md \
  --phase impl \
  --run-coder \
  --gate levelB

# セッション継続
./.claude/commands/auto_orchestrate.sh \
  --resume .claude/tmp/task/state.json \
  --continue-session

# 状態確認
./.claude/commands/auto_orchestrate.sh \
  --resume .claude/tmp/task/state.json \
  --status
```

### 主要オプション

| オプション | 説明 |
|-----------|------|
| `--plan PATH` | プランファイルのパス |
| `--phase PHASE` | フェーズ名（test, impl等） |
| `--resume STATE_FILE` | state.json から再開 |
| `--run-coder` | Claude Code で Coder を自動起動 |
| `--gate levelA\|B\|C` | 品質ゲートレベル |
| `--fix-until LEVEL` | 修正対象レベル（high/medium/low） |
| `--max-iterations N` | レビュー反復回数（デフォルト: 5） |
| `--reviewers LIST` | レビュワー一覧（safety,perf,consistency） |

### フォルダ構成

```
.claude/
├── settings.json            # Hook設定
├── commands/
│   ├── auto_orchestrate.sh  # メインオーケストレーター
│   ├── codex.sh             # 簡易Codex呼び出し
│   ├── README.md
│   └── lib/                 # 共有ライブラリ
│       ├── utils.sh
│       ├── state.sh
│       ├── coder.sh
│       ├── reviewer.sh
│       ├── session.sh
│       └── timeout.sh
├── hooks/
│   └── codex-review-hook.sh # Edit/Write後のキュー蓄積
├── skills/
│   ├── auto-orchestrator/   # オーケストレータースキル
│   └── codex-caller/        # Codex呼び出しスキル
└── tmp/                     # 一時ファイル・state.json
```

### PostToolUse フック

Edit/Write 操作後、変更ファイルを `.claude/tmp/review_queue.json` にキュー蓄積。
フェーズ完了時に一括レビュー実行。

---

## Codex 呼び出しルール（CRITICAL）

Claude Code から Codex CLI を呼び出す際の必須ルール。

### 1. Wrapper 経由必須

**絶対に直接 `codex exec` を呼ばないこと。** 必ず専用 wrapper 経由で呼び出す。

| 役割 | Wrapper | Reasoning Effort | 用途 |
|------|---------|------------------|------|
| **Coder** | `./scripts/codex-wrapper-high.sh` | high | 実装・修正タスク |
| **Reviewer** | `./scripts/codex-wrapper-xhigh.sh` | xhigh | レビュー・品質検証 |

```bash
# ✅ 正しい呼び出し方（Coder）
cat prompt.md | ./scripts/codex-wrapper-high.sh --stdin > output.md

# ✅ 正しい呼び出し方（Reviewer）
cat prompt.md | ./scripts/codex-wrapper-xhigh.sh --stdin > output.md

# ❌ 間違い（直接呼び出し禁止）
codex exec -c model=gpt-5.2-codex prompt.md
```

### 2. `-c` オプション禁止

model や model_reasoning_effort を `-c` で指定しない。Wrapper が自動設定する。

```bash
# ✅ 正しい
./scripts/codex-wrapper-high.sh --stdin

# ❌ 間違い
./scripts/codex-wrapper-high.sh --stdin -c model=gpt-4
```

### 3. resume 禁止

`codex resume` は TTY（対話型端末）が必須のため、オーケストレーター経由では動作しない。

**代替手段:** 新規セッション（`codex exec`）で前回の結果をプロンプトに含めて再実行する。

### 4. 標準入力でプロンプトを渡す

ファイル名を引数で渡してもコンテキストにならないため、必ず `--stdin` を使用。

```bash
# ✅ 正しい（標準入力経由）
cat prompt.md context.md | ./scripts/codex-wrapper-high.sh --stdin > output.md

# ❌ 間違い（ファイル名を渡してもコンテキストにならない）
./scripts/codex-wrapper-high.sh prompt.md context.md > output.md
```

### 簡易呼び出しコマンド

```bash
# Coder（実装）用
./.claude/commands/codex.sh coder "プロンプト"
./.claude/commands/codex.sh coder --file prompt.md

# Reviewer（レビュー）用
./.claude/commands/codex.sh reviewer "プロンプト"
./.claude/commands/codex.sh reviewer --file prompt.md
```

### Wrapper のログ出力例

```
[codex-wrapper-high] INFO: Model: gpt-5.2-codex
[codex-wrapper-high] INFO: Reasoning Effort: high
[codex-wrapper-high] INFO: Command: exec
```

---

## トラブルシューティング

### ビルドエラー
```bash
cargo clean && cargo build --release
```

### `--render` でエラー
Chrome/Chromiumがインストールされているか確認:
```bash
which chromium || which google-chrome
```

### タイムアウト
`--timeout` で秒数を増やす:
```bash
cargo run --release -- --url <URL> --folder ./output --timeout 60
```

### Codex CLI が見つからない
```bash
# インストール確認
command -v codex && codex --version

# Wrapper 動作テスト
./scripts/test-codex-integration.sh
```
