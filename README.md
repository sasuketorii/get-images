# すしの手 (Sushi no Te)

Webページ内の画像を検出し、選択した画像を一括ダウンロードできるChrome拡張機能です。

## 機能

- サイドパネルUIで画像を一覧表示
- ページ内の画像を自動検出（img, lazy-load, CSS background-image）
- クリックで画像を選択し、一括ダウンロード
- ドメイン名のサブフォルダに自動整理
- 同一画像の重複排除（要素ベース + URL正規化）
- ライト/ダークモード切替

## インストール

### Chrome Web Store

（審査通過後に公開予定）

### 開発版（ローカル）

```bash
git clone https://github.com/sasuketorii/get-images.git
cd get-images
npm install
npm run build
```

1. Chrome で `chrome://extensions/` を開く
2. 「デベロッパーモード」をON
3. 「パッケージ化されていない拡張機能を読み込む」→ `dist/` フォルダを選択

## 使い方

1. 拡張機能アイコンをクリックしてサイドパネルを開く
2. 「画像を検出」ボタンでページ内の画像をスキャン
3. カードをクリックして保存したい画像を選択
4. 「一括ダウンロード」ボタンで選択した画像をダウンロード

## 技術スタック

| 項目 | 技術 |
|------|------|
| マニフェスト | Chrome Extension Manifest V3 |
| 言語 | TypeScript |
| ビルド | Vite |
| UI | サイドパネル (Side Panel API) |
| ダウンロード | chrome.downloads API |

## 権限

| 権限 | 用途 |
|------|------|
| `activeTab` | アクティブタブへのアクセス |
| `scripting` | 画像検出スクリプトの注入 |
| `downloads` | 画像のダウンロード保存 |
| `sidePanel` | サイドパネルUIの表示 |
| `tabs` | タブとの通信 |

## プライバシー

この拡張機能はユーザーデータを一切収集・送信しません。
詳細は [PRIVACY_POLICY.md](PRIVACY_POLICY.md) を参照してください。

## ライセンス

MIT License
