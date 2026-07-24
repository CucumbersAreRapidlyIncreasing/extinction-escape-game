# 絶滅迫る地球からの脱出 ブラウザゲーム

ストーリー重視の謎解きゲームのブラウザ版です。現在は第1〜第5画面、第6画面ダミー、3D備品を収録しています。

## 内容

- `index.html` — 第1画面（プロローグ、登場人物、注意事項）
- `styles.css` / `app.js` — 第1画面の表示と演出
- `screen2.html` / `screen2.css` — 第2画面（オープニング動画、ストーリー）
- `screen3.html` / `screen3.css` / `screen3.js` — 第3画面（問題、備品ケース、ロボチャット）
- `screen4.html` / `screen4.css` / `screen4.js` — 第4画面（電源復旧資料、備品ケース、ロボチャット）
- `control-room.html` / `control-room.css` / `control-room.js` — 5連ダイヤル式コントロールルーム
- `screen5.html` / `screen5.css` / `screen5.js` — 第5画面（エンジン起動資料、備品ケース、ロボチャット）
- `engine-control-room.html` / `engine-control-room.css` / `engine-control-room.js` — 5色同時押し式コントロールルーム
- `screen6.html` / `screen6.css` / `screen6.js` — タイムマシン資料と第6画面
- `time-machine-control-room.html` / `time-machine-control-room.css` / `time-machine-control-room.js` — 5色レバー式タイムマシン起動テスト
- `assets/screen6/` — タイムマシン資料・暗号表の画像／PDF
- 第6画面のロボへ「暗号表」と伝えると暗号表が備品ケースへ追加され、解読機ボックスと組み合わせて7×7盤上を転がせます
- `screen7.html` / `screen7.css` / `screen7.js` — MISSION 05「無事に故郷に帰る」とパームスキャン認証
- `screen8.html` / `screen8.css` / `screen8.js` — 最終エンジン始動、ロボへのタイムマシン指示、エンディング分岐
- `bad-end.html` / `bad-end.css` / `bad-end.js` — 離陸動画とストーリーを含むバッドエンド
- `true-end.html` / `true-end.css` / `true-end.js` — 二段階の動画とストーリーを含むトゥルーエンド
- `progress.js` / `progress.css` — 画面移動、ブラウザ内進行保存、リセットメニュー
- STEP 1以降の「軌道予測」では、保存された現在の進行度を初期位置として、地球をドラッグしながら地球と隕石の位置を1分刻みで確認できます
- ハンバーガーメニューの「ステップ別リセット」では、指定ステップ以降の保存状態だけを削除してプロローグへ戻れます
- `prototype-3d.html` — 認証コード解読機ボックスの3D試作
- `prototype-3d.js` — 外部ライブラリを使わないWebGLビューア
- `assets/authentication-box.glb` — ゲーム組み込み用glTF Binary
- `assets/models/three-color-pen.glb` — 3色ボールペンのglTF Binary
- `assets/models/three-color-pen.blend` — 部品別に編集できるBlender原本（実寸145 mm）
- `assets/authentication-box-atlas.png` — 6面を整理したテクスチャ
- `tools/build_cube.py` — 元画像からアセットを再生成するスクリプト
- `tools/build_pen.py` — Blenderで3色ボールペンの `.blend` / `.glb` を再生成するスクリプト
- `tools/export_pen.py` — 手作業で編集したBlender原本を作り直さず、ゲーム用GLBだけを書き出すスクリプト

## 確認方法

ローカルWebサーバーを起動し、`index.html`を開きます。ファイルを直接開いた場合もプレビューできます。

3D試作は上下左右へのドラッグ／スワイプで制限なく360°回転でき、ホイールまたは画面下のボタンで拡大縮小できます。
GLBの読み込みにはHTTPが必要なため、3色ボールペンの確認時はローカルWebサーバーを使用してください。
