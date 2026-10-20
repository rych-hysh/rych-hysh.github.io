# Personal Site

Astro + GSAP + Lenis で作った個人サイト。

## 開発

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # dist/ に静的ファイルを出力
```

## 内容の編集

**編集するのは `content/` フォルダだけ**です（コードを触る必要はありません）。

| ファイル | 内容 |
|---|---|
| `content/profile.yaml` | 名前・肩書き・紹介文・SNS リンク |
| `content/career.yaml` | 経歴 |
| `content/skills.yaml` | スキル・資格 |
| `content/travel.yaml` | 旅行先（緯度・経度で地球儀にピン） |
| `content/photos.yaml` | 写真のタイトル・場所・並び順 |
| `content/photos/` | 写真ファイル置き場 |

- 写真は `content/photos/` に入れるだけで表示されます。スマホの写真をそのまま入れても、ビルド時に自動で縮小・WebP 変換されます（HEIC は非対応なので JPG で書き出してください）
- `npm run dev` 中は保存するとブラウザに即反映されます
- 書き間違い（必須項目の抜け、緯度が範囲外など）があると、どのファイルのどこが違うかをエラーで教えてくれます

## 構成

| ファイル | 内容 |
|---|---|
| `src/components/Hero.astro` | ファーストビュー（パーティクル背景・文字アニメ・タイピング） |
| `src/components/About.astro` | 自己紹介・経歴タイムライン |
| `src/components/Skills.astro` | マーキー・スキルカード・資格 |
| `src/components/Hobbies.astro` | 写真の横スクロールギャラリー・旅行先の地球儀 |
| `src/components/Contact.astro` | SNS リンク |
| `src/scripts/main.ts` | スクロール連動アニメーション全般（GSAP ScrollTrigger） |
| `src/scripts/heroCanvas.ts` | ヒーロー背景のパーティクルネットワーク |
| `src/scripts/globe.ts` | ドット地球儀（Canvas） |
| `src/data/profile.ts` | `content/` の読み込みと形式チェック |
| `src/data/palette.ts` | カード等に割り当てるアクセントカラー |

`prefers-reduced-motion` が有効な環境ではアニメーションを抑えて表示します。

## 公開（GitHub Pages）

`main` に push すると GitHub Actions（`.github/workflows/deploy.yml`）がビルドして
https://rych-hysh.github.io に公開します。

### 独自ドメインにする場合

1. `public/CNAME` を作り、ドメイン名を 1 行だけ書く（例: `example.com`）
2. `astro.config.mjs` の `site` を `https://example.com` に変更
3. ドメインの DNS を設定
   - `www.example.com` のようなサブドメイン → CNAME レコードで `rych-hysh.github.io` を指す
   - `example.com`（apex）→ A レコードで `185.199.108.153` / `185.199.109.153` / `185.199.110.153` / `185.199.111.153`
4. GitHub のリポジトリ → Settings → Pages で Custom domain を確認し、「Enforce HTTPS」をオン
