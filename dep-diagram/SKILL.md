---
name: dep-diagram
description: 変更が追加・変更するファイルと関数、その依存（使う・使われる）を、1 枚の HTML の図にして見せる。変更の全体像を確認してもらうとき、レビューや設計の説明で依存関係を示したいときに使う。
---

# dep-diagram

差分に関わるファイルと関数を、依存の矢印つきで 1 枚の HTML にする。構造（ファイル、変更の印、関数、矢印）は同じディレクトリの `gen.mjs` がコードから機械的に作る。AI が書くのは文章（見出し、ファイルの要約、関数の説明）だけ。描画は `template.html` で、描画コードは変えない。

## 図でわかること
- ファイルはディレクトリの入れ子のカード、関数は行。左は `rightDir` 以外、右は `rightDir` 配下。
- バッジは git と同じ 1 文字（新規 A・緑、変更 M・黄、削除 D・赤）。変更なしは灰でバッジなし。テストは青の「テスト」。色名は Chakra UI v3 の color scheme 名。
- 矢印は「使う」。同じディレクトリ内は点線、別ディレクトリは実線、テストからは破線（選んだときだけ出る）。絞り込み中は、両端のどちらかが合う線だけ濃く出る。
- ファイルか関数を選ぶと「使う」「使われる」を、相手のファイルごとのカードで出す（中に相手の関数名。ファイル単位は「全体」、無ければ「–」）。

## 手順（2 パス）
リポジトリの中で実行する（git のオブジェクトだけを読み、作業ツリーは見ない）。出力はリポジトリの外に置く。パス 1 で構造と空の notes を作り、AI が文章を埋め、パス 2 で入れ直す。

1. 構造と文章の骨組みを作る。
   ```
   node <skill>/gen.mjs --base <ref> [--head HEAD] [--right <dir>] [--config cfg.json] \
     --emit-notes /tmp/notes.json --out /tmp/dep-diagram.html
   ```
   `--right` は右ペインにするディレクトリ（既定 `features`）。`notes.json` は `{"$title": …, "パス": 要約, "パス#関数id": 説明}` で、値は空か、コードのコメントから取れた 1 行。
2. 空の値を埋める。変更されたファイルと関数のコードを読み、「何をするか」を 1 行で書く。キーと構造は変えない。読んだ範囲だけで書き、推測しない。`$title` は図の見出し。
3. 文章を入れて作り直す（`--emit-notes` を `--notes /tmp/notes.json` に替える）。notes は文章にだけ効き、ファイル・印・関数・矢印は変わらない。notes にないキーは警告して無視する。
4. 開いて確かめる（下の「確認」）。

## gen.mjs が決めること（同じ入力なら同じ出力）
- ファイル: `git diff --name-status` の A/M/D。リネームは D + A。変更ファイルを import している／しているファイル（1 段）を「変更なし」で足す。barrel は素通しする。
- 関数: トップレベルの関数・クラス・型・enum・定数。変更ファイルは `git diff -U0` に触れたものを `add` / `mod`、消えたものを `del`。変更なしのファイルは矢印の端になるものだけ。
- 矢印: TypeScript の checker で import と参照を辿る（paths、barrel、`export … from`、`ns.fn`）。副作用 import、動的 import / require、`export *` はファイル単位。テスト（`*.test.*`、`*.spec.*`、`__tests__/`、`e2e/`）は破線。
- 並びは文字列順。時刻や絶対パスは出さない。要約の既定はファイル先頭コメントの 1 行目、関数の説明の既定は直前の JSDoc の 1 行目。

## 任意の設定（`--config cfg.json`）
```
{ "title": "見出し", "zones": [{"id": "api", "label": "API", "color": "blue", "match": ["src/api/**"]}], "ignore": ["**/*.md"] }
```
- `zones` は上から順に最初に合った glob。使われた zone だけ出る。同じ色を mark と zone で重ねない。
- `ignore` に合うファイルは出さない。lockfile は既定で除く。
- `--max-importers N`（既定 30）を超える import 元は図に出さず、`extra` に先頭 8 件と件数を書く。

## 限界
- 矢印は TS / JS（`.ts .tsx .js .jsx .mjs .cjs .mts .cts`）だけ。ほかの言語や文書は、変更があればノードだけ出る。
- TypeScript は、対象リポジトリ、このディレクトリ、`/tmp` の順に 5.x / 6.x を探し、なければ `/tmp` に `npm i typescript@5`（ネットワークが要る）。7（native 版）には JS の compiler API が無いので使わない。型検査はしないので、型推論に頼る参照（メソッド呼び出し先など）は出ないことがある。
- 外部パッケージは出さない。近所は 1 段。リネームは追わない。削除ファイルを import していた「変更なし」ファイルの矢印は出ない。クラスのメソッドなどトップレベルでない宣言は外側に含める。

## DATA の形（手で直すときの参考）
```
DATA = {
  title?: string,
  marks?: [{label, color, badge?}],      // 絞り込みボタン。badge を書かない mark はバッジなし
  zones?: [{id, label, color}],          // 任意。カードの色味
  tagSymbols?: {tag: 記号},              // 関数行の頭の 1 文字（fn.tag ごと）
  files: [{ path, summary?, mark?, zone?, test?, extra?, fns?: [{name, id?, kind?, note?, tag?}] }],
  edges: [[from, to, {weak?: true}?]]    // "path" か "path#fnId"。weak かテストからは破線
}
```
- `CONFIG.rightDir`（既定 `"features"`）配下が右ペイン。どちらかが空でも動く。文言は `T`、線の間隔などは `CONFIG`。
- 削除ファイルの `mark` は `deleted`（color `red`）。

## 確認
- ブラウザで開き、コンソールにエラーがないこと（ライト・ダーク両方）。
- `gen.mjs` の標準エラーのファイル数・関数数・矢印数が図と合うこと。
- 同じコマンドを 2 回実行して `cmp` で一致すること。

## 出力
1 ファイルの HTML（外部の読み込みなし）。リポジトリの中には置かない（指示があるときだけ指定の場所）。報告には、HTML のパス、範囲（base と HEAD）、図に出さなかったファイルと理由、当てはまる限界を書く。
