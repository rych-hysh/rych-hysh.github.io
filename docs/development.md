# Development

[hryoichi.com](https://hryoichi.com) のソースです（Astro + GSAP）。

```bash
npm install
npm run dev     # http://localhost:4321
npm run build   # dist/ に出力
```

## 内容の編集

表示内容は `content/` の YAML と画像で管理しています。

| ファイル | 内容 |
|---|---|
| `content/profile.yaml` | 名前・紹介文・SNS |
| `content/career.yaml` | 経歴 |
| `content/skills.yaml` | スキル・資格 |
| `content/travel.yaml` | 旅行先（緯度・経度） |
| `content/photos.yaml`, `content/photos/` | 写真 |
| `content/bike.yaml`, `content/bike/` | バイク |

`main` に push すると GitHub Actions でビルド・公開されます。
