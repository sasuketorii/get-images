# get_frontend

URLを指定するだけでWebページのHTML、CSS、JavaScriptを自動取得するRust製CLIツールです。Claude Codeと連携して、Webサイトのフロントエンドリソースを簡単に取得・分析できます。

## クイックスタート（Claude Code）

Claude Codeで `/fetch` コマンドを実行するだけで、Webページのフロントエンドを取得できます。

```
/fetch https://example.com
```

これだけで `output/{ドメイン名}/` に以下が自動保存されます：
- `index.html` - HTMLファイル（パス書き換え済み）
- `css/` - 外部CSS・インラインCSS
- `js/` - 外部JavaScript・インラインJS
- `images/` - 画像ファイル

### 典型的なワークフロー

```
# 1. Webサイトのフロントエンドを取得
/fetch https://target-site.com

# 2. 取得したファイルを確認・分析
# Claude Codeが output/ フォルダ内のファイルを読み取り可能

# 3. 必要に応じてコードを参考にして開発
```

## 機能一覧

| 機能 | 説明 |
|------|------|
| HTML/CSS/JS一括取得 | 指定URLから全フロントエンドリソースを自動ダウンロード |
| インラインコード抽出 | `<style>` / `<script>` タグ内のコードも個別ファイルとして保存 |
| CSS内リソース再帰取得 | `@import` や `url()` で参照されるCSS・画像・フォントも自動取得 |
| SPA対応 | `--render` オプションでJavaScript実行後のDOMを取得可能 |
| 画像ダウンロード | `--download-images` で画像もローカル保存 |
| 複数出力形式 | JSON / スタンドアロンHTML / フォルダ構成 |

## インストール

### 必要要件

- Rust 1.70以上
- `--render` オプション使用時: Google Chrome または Chromium

### ビルド

```bash
cd /Users/sasuketorii/dev/get_frontend
cargo build --release
```

ビルド後、`target/release/get_frontend` にバイナリが生成されます。

### PATHへの追加（推奨）

```bash
# シンボリックリンクを作成
sudo ln -sf /Users/sasuketorii/dev/get_frontend/target/release/get_frontend /usr/local/bin/get_frontend

# または .zshrc / .bashrc に追加
export PATH="$PATH:/Users/sasuketorii/dev/get_frontend/target/release"
```

## Claude Codeスキル一覧

このプロジェクトには `.claude/commands/` にClaude Code用のスキルが含まれています。

| スキル | 説明 | 出力先 |
|--------|------|--------|
| `/fetch` | フォルダ構成で保存（画像込み） | `output/{ドメイン}/` |
| `/fetch-spa` | SPA対応（JS実行後のDOM取得） | `output/{ドメイン}/` |
| `/fetch-standalone` | 単一HTMLファイルで保存 | `output/{ドメイン}_standalone.html` |
| `/fetch-json` | JSON形式で保存 | `output/{ドメイン}.json` |

### /fetch

Webページのフロントエンドを取得して `output/` にフォルダ構成で保存します。

```
/fetch https://example.com
```

**出力先:** `output/{ドメイン名}/`

**含まれるファイル:**
- `index.html` - メインHTML（ローカルパスに書き換え済み）
- `css/*.css` - 外部CSSファイル、インラインスタイル
- `js/*.js` - 外部JSファイル、インラインスクリプト
- `images/*` - 画像ファイル

### /fetch-spa

SPA（Single Page Application）対応版。ヘッドレスブラウザでJavaScriptを実行した後のDOMを取得します。

```
/fetch-spa https://react-app.example.com
```

**出力先:** `output/{ドメイン名}/`

### /fetch-standalone

CSS・画像をBase64でインライン埋め込みした単一HTMLファイルとして保存します。

```
/fetch-standalone https://example.com
```

**出力先:** `output/{ドメイン名}_standalone.html`

### /fetch-json

JSON形式でメタデータ含めて保存します。プログラムでの後処理に便利です。

```
/fetch-json https://example.com
```

**出力先:** `output/{ドメイン名}.json`

## CLIオプション（高度な使い方）

CLIを直接使用する場合の詳細オプションです。

### コマンドライン引数

| オプション | 短縮形 | 説明 | デフォルト |
|-----------|--------|------|-----------|
| `--url` | `-u` | 取得対象のURL（必須） | - |
| `--output` | `-o` | 出力ファイルパス | 標準出力 |
| `--render` | - | ヘッドレスブラウザでJS実行（SPA対応） | false |
| `--standalone` | - | CSS/画像をBase64埋め込みした単一HTML出力 | false |
| `--folder` | - | フォルダ構成で出力（パス指定） | - |
| `--download-images` | - | 画像をダウンロード（`--folder` 時のみ有効） | false |
| `--timeout` | - | タイムアウト秒数 | 30 |
| `--verbose` | `-v` | 詳細ログ出力 | false |

### 出力形式

#### 1. JSON形式（デフォルト）

```bash
get_frontend --url https://example.com
```

標準出力にJSON形式で出力されます。ファイルに保存する場合：

```bash
get_frontend --url https://example.com --output result.json
```

出力例:
```json
{
  "url": "https://example.com",
  "final_url": "https://example.com/",
  "html": "<!DOCTYPE html>...",
  "css": [
    { "type": "external", "url": "https://example.com/style.css", "content": "..." },
    { "type": "inline", "content": "..." }
  ],
  "js": [...],
  "images": [...],
  "fonts": [...],
  "metadata": {
    "fetched_at": "2026-01-21T10:00:00Z",
    "http_status": 200,
    "errors": []
  }
}
```

#### 2. フォルダ構成（Claude Codeスキルで使用）

```bash
get_frontend --url https://example.com --folder ./output --download-images
```

出力構造:
```
output/
└── example.com/
    ├── index.html
    ├── css/
    │   ├── style_1.css
    │   └── inline.css
    ├── js/
    │   ├── script_1.js
    │   └── inline.js
    └── images/
        ├── img_1.png
        └── img_2.jpg
```

#### 3. スタンドアロンHTML

CSS・画像をBase64でインライン埋め込みした単一HTMLファイル：

```bash
get_frontend --url https://example.com --standalone --output page.html
```

### 使用例

```bash
# 基本的な取得（JSON出力）
get_frontend -u https://example.com -o snapshot.json

# SPA/JavaScript実行後のDOM取得
get_frontend -u https://spa-example.com --render -o spa.json

# 完全なローカルコピー作成
get_frontend -u https://example.com --folder ./backup --download-images

# デバッグ用の詳細ログ
get_frontend -u https://example.com -v
```

## 技術仕様

| コンポーネント | 使用ライブラリ |
|---------------|---------------|
| HTTPクライアント | reqwest（gzip/brotli/deflate圧縮対応） |
| HTMLパーサー | scraper |
| CSSパーサー | cssparser |
| ヘッドレスブラウザ | chromiumoxide（CDP経由） |
| 非同期ランタイム | tokio + futures（最大10並列） |

## 制限事項

- 最大コンテンツサイズ: HTML 5MB、画像 10MB
- 最大リダイレクト回数: 10回
- スキップされるURL: `data:` / `javascript:` / `mailto:`
- 認証が必要なページは未対応
- CORSやCSPの制限があるリソースは取得できない場合あり

## ライセンス

MIT License
