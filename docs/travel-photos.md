# 旅行先の写真

旅行先と写真は `content/travel.yaml`、画像ファイルは `content/travel/` で管理します。
一般写真ギャラリーの `content/photos/` とは独立しています。画像を置くだけでは旅行先に自動登録されません。

## 登録方法

1. 公開してよい写真を `content/travel/` に保存します（jpg / jpeg / png / webp / avif）。
2. 該当する場所の `photos` にファイル名・代替テキストを登録します。配列の順番が表示順です。
3. 必要なら場所の `description` と各写真の `caption` を記入します。
4. `npm run build` で画像参照を含めて確認します。

以下は記入形式の例です。ファイル名と文章を実際の内容に置き換えてから使用してください。

```yaml
- place: Tokyo
  id: tokyo
  region: Japan
  lat: 35.68
  lng: 139.69
  description: |
    ここに旅行の記録を記入します。
    改行して複数行にもできます。
  photos:
    - file: your-photo.jpg
      alt: 写っている景色や被写体の説明
      caption: 写真に添える短い文章（省略可）
```

`id` は場所への固定リンク `/travel/#travel-tokyo` に使います。半角小文字・数字・ハイフンで重複しない値を指定し、公開後は変更しないでください。従来の place / region / lat / lng だけのデータも読み込めますが、id がないと並び順由来の仮IDになるため、固定リンクには明示した id を推奨します。

`description` と `photos` は省略できます。写真がある場所だけ、写真の枚数と＋ボタンを表示して詳細を展開します。写真がない場所は地名だけを表示し、地球儀で場所を確認できます。写真がない旨の文言や空の詳細は表示しません。`alt` は必須、`caption` は任意です。存在しない画像、空の alt、重複 id はビルド時にエラーになります。

写真は Astro の Image で幅別に最適化され、遅延読み込みされます。縦長・横長とも全体が見える表示です。撮影者や訪問日時は自動生成しません。撮影者の表示が必要な場合は、確認済みの内容を caption に記入してください。

## 現在の登録内容とサンプル

Las Vegas（USA）を写真未登録の新しい旅行先として追加しています（2026-10-25追加）。旅行先は計20か所・9地域、USAはHawaii / Los Angeles / Las Vegasの3か所です。地球儀のピンは[GeoNamesのLas Vegas](https://www.geonames.org/5506956/las-vegas.html)の市街地の代表座標を小数点以下2桁に丸めたものです。追加時の本番ビルド成功。

Seoul（South Korea）にはユーザー指定の `korea.jpg`、`korea2.jpg`、`korea3.jpg`、`korea4.jpg` の順に4枚登録しています（2026-10-25追加）。当初はSouth Koreaという場所名で登録し、ユーザーの指定によりSeoulへ変更しました。地域はSouth Koreaのまま、地球儀のピンは[GeoNamesのSeoul](https://www.geonames.org/1835848/seoul.html)の市街地の代表座標を小数点以下2桁に丸めています。既存リンクを維持するため id は south-korea を保持しています。追加時点で旅行先は計19か所・9地域となり、場所名変更後も件数と写真は変わりません。本番ビルド成功。

Yamaguchi（Japan）にはユーザー指定の実写真を `yamaguchi-akiyoshido.jpg`、`yamaguchi-akiyoshido2.jpg`、`yamaguchi-akiyoshidai.jpg` の順に3枚登録しています（2026-10-25追加）。秋芳洞の入口・内部、秋吉台の順で、トップと旅行ページの両方に表示します。追加時の本番ビルド成功。

Taipei（Taiwan）にはユーザー指定の実写真を `taipei-museum.jpg`、`taipei-101.jpg` の順に2枚登録しています（2026-10-25追加）。追加時の本番ビルド成功。

Ruifang（Taiwan）を新しい旅行先として追加し、添付画像を `ruifang-lanterns.jpg` として1枚登録しています（2026-10-25追加）。追加時点で旅行先は計18か所・8地域となり、台湾はTaipei / Ruifangの2か所です。地球儀のピンは[GeoNamesのRuifang](https://www.geonames.org/1674097/ruifang.html)の市街地の代表座標を小数点以下2桁に丸めたものです（写真の撮影地点を示す座標ではありません）。追加時の本番ビルド成功。

Zaandam（Netherlands）を新しい旅行先として追加し、ユーザー指定の `zaandam.jpg` を1枚登録しています（2026-10-25追加）。追加時点で旅行先は計17か所・8地域となり、オランダはAmsterdam / Zaandamの2か所です。地球儀のピンは[GeoNamesのZaandam](https://www.geonames.org/2744118/zaandam.html)の市街地の代表座標を小数点以下2桁に丸めたものです（写真の撮影地点を示す座標ではありません）。追加時の本番ビルド成功。

Amsterdam（Netherlands）にはユーザー指定の実写真 `amsterdam-img-9826.JPG`、`amsterdam-img-9866.JPG` の順に2枚登録しています（2026-10-25追加）。候補 IMG_9865.JPG / IMG_9866.JPG は同じ景色のため、建物と水面の反射が大きく見える縦構図の IMG_9866.JPG を選定。追加時の本番ビルド成功。

Versailles（France）にはユーザー指定の実写真 `versailles-img-9370.JPG` を1枚登録しています（2026-10-25追加）。追加時の本番ビルド成功。

Paris（France）にはユーザー指定の実写真 `paris-img-1804.JPG`、`paris-img-1894.JPG` の順に2枚登録しています（2026-10-25追加）。仮のサンプル画像から差し替え、追加時の本番ビルド成功。

Mont-Saint-Michel（France）にはユーザー指定の実写真 `mont-saint-michel-img-1626.JPG` を1枚登録しています（2026-10-25追加）。追加時の本番ビルド成功。

London にはユーザー指定の実写真 `london-img-0188.JPG`、`london-img-0462.JPG`、`london-img-0927.JPG`、`london-img-1107.JPG` の順に4枚登録しています（2026-10-25追加）。追加時の本番ビルド成功。1枚目はPC・スマートフォン幅で表示と縦向きを確認済み。[1枚目の表示確認](previews/travel-london-mobile.png)

Tokyo / Kyoto の表示サンプル、サンプル用説明文、旅行専用のサンプル画像ファイルは削除済みです（2026-10-25）。一般写真ギャラリーは別の編集範囲のため、この変更では触っていません。

## 操作・統合の接点

- トップは従来どおり3件、旅行ページは地域別に全件。写真がある場所は summary をタップ、Enter、Space で展開します。JavaScript がなくても開閉できます。写真がない場所は通常の button で、＋・枚数・詳細は表示しません。
- 同時に1か所を展開します（JavaScript 有効時）。選択中の場所は地球儀でも強調され、ホバーを外しても維持されます。
- 地球儀のピンをタップすると、写真がある場所では写真を開き、写真がない場所では地名にフォーカスします。トップの3件にないピンは旅行ページの固定リンクへ移動します。ドラッグは従来どおり回転操作です。
- `Travel.astro` が写真表示と開閉時の ScrollTrigger 更新を担当します。`globe.ts` の連動セレクタは `data-travel` / `data-trip-entry` / `data-trip` です。`data-trip-location` は写真がない場所を示します。
- `src/data/profile.ts` の旅行データ部分を拡張しています。一般写真・バイク担当が同じファイルを変更する場合、travel 部分を保持してください。
- `main.ts`、一般写真ギャラリー、バイクデータ、公開設定は変更していません。

このブランチの作業はローカル確認までです。push / PR / merge / 公開は別途判断してください。

## 確認結果（2026-10-24）

- Node.js 24.22.1 で Astro の本番ビルド成功、`astro check` は22ファイル・エラー0・警告0。
- PC、390px幅、320px幅をブラウザーで確認。複数画像の読み込み、説明、キャプション、未登録表示、長い地名の折り返しを確認。
- 場所の切り替え、Enter / Space での開閉、固定リンク、地球儀のピンからの開閉を確認。
- トップの3件一覧と16件のピンを維持。トップにない Fukuoka のピンから `/travel/#travel-fukuoka` へ移動し、該当場所が開くことを確認。
- 画像欠落・空の alt・重複 id はビルド失敗、従来の4項目だけの16件データはビルド成功を確認。検証後はサンプル入りデータへ戻して再ビルド済み。
- ブラウザーで確認した範囲のコンソールエラー・警告は0。スマートフォンは画面幅での確認で、実機タッチ操作は未確認。

初期実装の確認画面（サンプル削除前）: [PC](previews/travel-desktop.png) / [スマートフォン幅](previews/travel-mobile.png)

## サンプル削除後の確認（2026-10-25）

- 旅行先は20か所を維持。旅行データ・専用画像置き場からサンプルを削除済み。
- トップと旅行ページで、写真がある場所だけ詳細・枚数・＋を表示することを確認。
- 写真のないTokyo / Kyotoは地球儀のみ操作でき、未登録メッセージや空の詳細は表示しないことをブラウザーで確認。写真がない場所のピンからも選択でき、コンソールエラーなし。
- Yamaguchiの実写真3枚は引き続き開閉できることを確認。
- 本番ビルド成功、`astro check` は22ファイル・エラー0・警告0。

[変更後の画面](previews/travel-no-samples.png)
