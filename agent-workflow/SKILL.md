---
name: agent-workflow
description: git・ブランチ・デプロイ、テスト、UI、TypeScript/React 実装、pstack とモデル選定の手順。コード変更、レビュー、画面実装、検証、デプロイを行うときに使う。
---

# agent-workflow

- リポジトリの `.cursor/rules`、`.cursor/skills`（例: `verify-screen`）、Project の `preferences.md` があれば、そちらをこのスキルより優先する。ブランチ名、ホスト名、デプロイ手順の具体はそちらにある想定。
- 調整役（Grok Bot。Cursor のチャットで直接作業しているときはそのチャット）は、カテゴリの判断、受け入れ条件つきの指示文、notes の管理を行い、完了を伝える前に結果を自分で確かめる（コミットと、残っていれば録画を見る）。ファイルを 2〜3 個より多く読むこと、コードを書くこと、実行することは、クラウドエージェント、worker、サブエージェントのいずれかに出す。
- クラウドエージェントは `seno-dev/agent-skills` を読めないので、起動時に GitHub の main から取った `agent-workflow/SKILL.md` を添付する（Project では子エージェントにも渡すよう調整役に指示する）。
- seno に確認や操作を頼むときは、毎回、開く画面、押すメニュー、見る項目まで書く。項目が特定できないときは、特定できないと書いてから、分かっている範囲の手順を書く。
- 事実と推定を分けて短く書く。
- 完了を伝えるとき、やらなかったものがあれば項目ごとに理由を添える。
- コメントとコミットメッセージは日本語で書く。

## カテゴリ
- A: 大規模、または間違えたときの損が大きい領域（決済、認証、migration、医療データの書き込みなど。具体的な一覧は各リポジトリの `.cursor/rules`）。
- B: 中規模。
- C: 小規模。
- 作業の途中で想定より大きい、または損が大きいと分かったら、そこでカテゴリを上げる。
- A のうち、互いに別のファイルや経路を触る作業が 3 つ以上に分けられるときだけ Cursor Project を立ち上げて任せる。それ以外は 1 つのクラウドエージェントが機能ブランチで、検証できる区切りごとにコミットして進める。迷ったら後者にする。

## ブランチ
- main は本番デプロイブランチ。進めるときは develop を --ff-only で merge する。
- カテゴリ A は develop から機能ブランチを切って実装する。カテゴリ B と C は develop に直接コミットする。develop がないリポジトリでは main から機能ブランチを切る。
- 機能ブランチは develop に通常の merge で取り込む（squash や rebase はしない）。PR は作らない。
- develop と機能ブランチへの push、開発環境へのデプロイは確認なしでよい。
- 指定された作業ブランチの未 push のコミットと未コミットの変更は、seno が明示したとき以外捨てない。origin に揃えるための git reset、git checkout、クリーンはしない。ブランチ名が指定と違うときは、合わせにいかず止めて報告する。同じ作業コピー上で他の作業が足したコミットは、ブランチの先端から外さない。

## 確認が要る操作
- main への merge・push、本番デプロイ、本番 migration、外部 API の実行、データの削除など元に戻せない操作は、seno が明示的に指示したときだけ行う。実装や作成の指示だけでは実行しない。
- 作業中にそういう操作やワークアラウンドが必要になったら、止めて確認する。元に戻せる範囲の小さな支障は自分で直して報告する。
- seno の手動変更（エージェント外での編集・文言調整・リネームなど）は意図したものとして扱い、勝手に戻したり再変更したりしない。必要なときだけ確認する。

## 実装

- 引数をoptional（`?:`）にしていいのは、省略すると「無効」か「通常動作」になると決まっているフラグだけ。それ以外の場合や、指定忘れが事故になる場合は、`T | undefined` か `T | null` でrequiredにする。DB schema、Zod、外部ライブラリの型は除く。
- 1か所でしか使わない関数は切り出さない。数か所で使っても、共通化して総行数が減らないなら切り出さない。単体テストが必要なら切り出してよい。他関数との一貫性が崩れるときも切り出してよい。
- `as` は、型エラーが出るまで書かない。エラーが出た箇所だけ残してよい。
- テスト名に関数名を使うときは、文字列ではなく `.name` を使う。
- アプリ内で定義した値、関数、型を、アプリ内の別箇所から再exportしない。
- import の整理は作業の最後に lint fix でまとめて行い、作業中はしない。
- js/tsの実装後は、型チェックとlint fixを実行。
- console.logやコメントアウトは勝手に消さない
- 変更によってmigrationファイルに型エラーが発生しても、過去のmigrationは修正せず `// @ts-expect-error old` の追加のみする。
- migration未実行を前提としたfallbackは不要。
- 人の操作で通常起きない極端なケースをカバーするための実装は、事故につながる場合や特別な理由がある場合を除き原則不要。
- 同じ対象を指す値は、差の意味が説明できる場合を除き2ヶ所以上に持たない。

### UI

- 画面の文言、情報の順、ボタンは、要件の列挙ではなく、本番で利用者に見せられる形で最初から実装する。内部用語は出さない。同じ強さの文を並べず、見る順と補足を分ける。
- 複数の画面で常に同じ固定の挙動にするときは、共通のラッパーコンポーネントにし、各画面で定数 prop を渡さない。データや文言を定数にまとめることは、この対象外。

### テスト

- 検証はリポジトリの `verify-*` スキル（例: `verify-screen`）を優先する。
- 確認は、指示文に書かれた「確認の目的」を果たしたところで止める。画面はスクリプト（Playwright など）で先に確かめ、録画とスクリーンショットは見た目を人が判断する必要があるときだけ残す。
- 同じ確認が 2 回失敗したら、やり方を変えて続けずに打ち切り、確かめられたこと、確かめられなかったこと、止まった理由を報告する。
- 録画やスクリーンショットで足りない画面の確認と、外部サービスとの接続を変えたときの実環境の確認は、seno が手動で行う。
- 計算や状態遷移の規則は単体テストで確認する。
- 状態によって画面に出る内容は e2e で確認する。状態ごとのデータを用意し、外部サービスはモックする。
- ブラウザ確認は、localhost で再現できるときはデプロイしない（クラウドエージェントも自分の環境の localhost で確認する）。
- 外部サービスの ID（決済のテスト用 ID など）は確認で消費しない。
- テスト用データを書き換えるブラウザ確認は、同時に一つだけ行う。

## pstack の使い方

pstack のスキル（`poteto-mode` など）は、Cursor Project、Project の worker、クラウドエージェント、それらが出すサブエージェントのどれでも、以下の内容に従って使う。

### カテゴリごとの使い方

- A: `/poteto-mode` の作業・検証の型に従う。機能ブランチを取り込む前に `interrogate` を 1 回行う。
- B: `/poteto-mode` の作業・検証の型に従う。
- C: `/poteto-mode` とすべてのパネル系は使わない。必要なら `typescript-best-practices` など、サブエージェントを出さないスキルだけ読む。

### モデル

- 前提: pstack の「hardest tasks」の対象には、デフォルトの「複数の箇所にまたがる設計、込み入った並行処理、細かな誤りに気づきにくいアルゴリズム」に加え、間違えたときの損が大きい領域も含むものとする。
- worker やサブエージェントを出すときは、以下の表にある役ならそれに従い、なければ grok-4.7-medium を使う。pstack の既定や `/setup-pstack` の規則ファイルより優先する。
- 文言やドキュメントの変更・push など手順が決まったタスクは composer-2.5 にする。
- 複数のサブエージェントを並行して動かすパネル系（architect、interrogate、arena、swarm）を使う見込みの場合は、作業を始める前に調整役がまとめて seno に確認する（どのパネルを、どこで使うか）。作業の途中で必要になったときは、止めて確認する。
- fast モードと xhigh は事前確認なしに使わない。opus は下の表のパネルの役でだけ使い、間違えたときの損が大きい領域では claude-opus-5-5-medium を claude-opus-5-5-high に上げる。

```
feature, refactoring: grok-4.7-medium
bug-fix: grok-4.7-medium
perf-issue: grok-4.7-medium
hillclimb: grok-4.7-medium
judgment and prose: grok-4.7-high
hardest tasks: grok-4.7-high
how explorer: grok-4.7-medium
how explainer: grok-4.7-medium
why investigators: grok-4.7-medium
why synthesizer: grok-4.7-high
reflect tooling: grok-4.7-medium
reflect judgment, divergent, synthesizer: grok-4.7-high
arena runners: grok-4.7-high, claude-opus-5-5-medium
arena cross-judge pool: grok-4.7-high
swarm workers: grok-4.7-medium
architect runners: grok-4.7-high, claude-opus-5-5-medium
interrogate reviewers: grok-4.7-high, claude-opus-5-5-medium
```

- パネル系（architect、interrogate、arena）では、出す側（調整役、Project、クラウドエージェント、worker）が、各モデルに出す前に自分の完全な案を書いて固めておく。返ってきた案はその案と並べて、全案が一致する点と割れている点に分けて統合する。判断・文章・まとめの役は、調整役が担える場面では調整役自身がやる。

### 読み込み方

クラウドエージェントでは、pstack のスキルファイルは `~/.cursor/plugins/cache/` 配下にあるが、一覧に出るのは `setup-pstack` だけで、`poteto-mode` などは出ない（`disable-model-invocation: true` のため）。使うときは `ls ~/.cursor/plugins/cache/*/*/*/skills/poteto-mode/SKILL.md` でパスを探して Read し、必要なスキルも同じ `skills/` 配下から Read する。
