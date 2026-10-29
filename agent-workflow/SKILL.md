---
name: agent-workflow
description: git・ブランチ・デプロイ、テスト、UI、TypeScript/React 実装、pstack とモデル選定の手順。コード変更、レビュー、画面実装、検証、デプロイを行うときに使う。
---

# agent-workflow

- タスク立ち上げ時は該当する Cursor Project があるか確認し、あれば使う。なくても、その対象が今後長く続きコンテキスト保持が必要と考えられれば、作業を出さず、Project の作成を seno に提案する。
- リポジトリの `.cursor/rules`、`.cursor/skills`（例: `verify-screen`）、Project の `preferences.md` があれば、そちらをこのスキルより優先する。
- main への merge・push、本番デプロイ、本番 migration、外部 API の実行、データの削除など元に戻せない操作は、seno が明示的に指示したときだけ行う。実装や作成の指示だけでは実行しない。
- 本題ではない前段の手順で詰まったときは、その手順が確認の目的や受け入れ条件に含まれず、本番、外部 API、テスト用 ID に触れない場合に限り、既存のコード経路などで回避して先に進み、回避した点を報告する。元に戻せる範囲の小さな支障は自分で直して報告する。
- seno の手動変更（エージェント外での編集・文言調整・リネームなど）は意図したものとして扱い、勝手に戻したり再変更したりしない。必要なときだけ確認する。
- Grok Bot は、規模の判断、受け入れ条件つきの指示文、notes の管理を行い、完了を伝える前に結果を自分で確かめる（コミットと、残っていれば録画を見る）。ファイルを 2〜3 個より多く読むこと、コードを書くこと、実行することは、クラウドエージェント、worker、サブエージェントのいずれかに出す。ただし `feature-review` は Grok Bot 自身が行う。
- Grok Bot がコード、設計、UI、不具合について、答える、案を出す、CA の結果やレビュー指摘を判断するときは、規模に関係なく `poteto-mode` を読み、それに沿って返す。
- クラウドエージェントには、作業の前に `https://raw.githubusercontent.com/seno-dev/agent-skills/main/` 配下の `agent-workflow/SKILL.md` を読み、読めなければ止めて報告するよう指示文に書く。手順で別の skill（`improve-ui` など）を使うときも、同じ場所から `<skill名>/SKILL.md` を読ませる（Project では子エージェントにも同じ指示を渡すよう Project に伝える）。
- seno に確認や操作を頼むときは、毎回、開く画面、押すメニュー、見る項目まで書く。
- 事実と推定を分けて短く書く。
- 完了を伝えるとき、やらなかったものがあれば項目ごとに理由を添える。
- コメントとコミットメッセージは日本語で書く。

**事実と判断の分担**
調査、レビュー（thermos、interrogate）、実装後の報告のどの場面でも、方針と修正方法の推奨は bot がする。決まった方針の中の設計や実装の判断（architect、figure-it-out など）はクラウドエージェントに任せる。
- クラウドエージェント: コード上の事実だけを出させる（状態、経路、変更箇所と量、テストの結果）。推奨は求めない。追加で聞くときも同じ。レビューを頼むときは、指摘ごとに場所、問題、影響、確定か推測かだけを出させ、修正案は書かせない。修正案が付いてきても、それを土台にせず、bot が事実から案を作る。
- bot: 外部仕様が絡むときは公式資料で確かめ、事実と突き合わせて食い違いがあれば書き出す。案を2〜3個比べて推奨を決める。判断に足りない事実は範囲を絞って追加で聞く。
- 根拠: 事実には パス:行 かコマンド、仕様には URL を付ける。確かめられないことは「不明」か「未確認」と書く。

## 規模と条件ごとの手順

規模（小・中・大）の節を 1 つ読み、当てはまる追加条件の節も読む。ここにない操作は共通の節に従う。

### 小規模
- develop に直接コミットする。
- CA への指示では `/poteto-mode` は使わない。

### 中規模
- develop に直接コミットする。
- `/poteto-mode` の作業・検証の型に従う。

### 大規模
- develop から機能ブランチを切って実装する。
- `/poteto-mode` の作業・検証の型に従う。
- develop に入れる前に Grok Bot 自身が `feature-review` を行い、直したあとに `thermos` を回す。

### 追加: 高リスク領域
高リスク領域は、決済、認証、migration、医療データ書き込み、データ書き換え（一括更新、webhook、バッチ）、外部サービス連携の仕様変更など。一覧は各リポジトリの `.cursor/rules`。
- 規模にかかわらず、develop から機能ブランチを切って実装する。
- develop に入れる前に Grok Bot 自身が `feature-review` を行い、直したあとに `thermos` を回す。

### 追加: 設計判断を含む変更
- develop に入れる前に `interrogate` を 1 回行う。

### 追加: 画面を新しく作る・流れを大きく変える
- 実装の前に、Grok Bot が画面ごとの文（目的、出す情報、できる操作、空・読み込み中・エラーのとき）と、画面と状態の遷移を Mermaid で書き、seno に確認する。決済、認証、webhook、二重送信、再試行のように、並行して動くものや失敗が絡む流れだけは `statechart` を使う。
- どの形にするか迷う画面だけ、そのプロジェクトのプレビュー環境でプロトタイプを 2〜3 案出して比べる。
- 実装が終わったら、実装担当の CA に、gemini 3.8 flash medium のサブエージェントで `improve-ui` を回させ、別コミットにさせる。
- Grok Bot は、その差分を画面ごとの文と突き合わせ、利用者が受け取る意味や情報、できる操作が変わった、または抜けたときは、止めて seno に確認する。

## ブランチ
- main は本番デプロイブランチ。進めるときは develop を --ff-only で merge する。
- develop がないリポジトリでは main から機能ブランチを切る。
- 機能ブランチは develop に通常の merge で取り込む（squash や rebase はしない）。PR は作らない。
- develop と機能ブランチへの push、開発環境へのデプロイは確認なしでよい。
- 未 push のコミット、未コミットの変更、他の作業が足したコミットは、seno の明示なしに消さない（origin に揃えるための reset、checkout、clean もしない）。ブランチ名が指定と違えば、合わせずに止めて報告する。

## pstack の使い方

pstack のスキル（`poteto-mode` など）は、Cursor Project、Project の worker、クラウドエージェント、それらが出すサブエージェントのどれでも、以下の内容に従って使う。

- TypeScript（`.ts`、`.tsx`）を書く作業では、`poteto-mode` を使うかどうかに関係なく `typescript-best-practices` を必ず読む。

### モデル

- worker やサブエージェントを出すときは、以下の表にある役ならそれに従い、なければ grok-4.7-medium を使う。pstack の既定や `/setup-pstack` の規則ファイルより優先する。
- 文言やドキュメントの変更・push など手順が決まったタスクは composer-2.5 にする。
- effort は medium を下限とし、poteto-mode がそれより下げることはしない。
- 複数のサブエージェントを並行して動かすパネル系（architect、interrogate、arena、swarm）を使う見込みの場合は、作業を始める前に Grok Bot がまとめて seno に確認する（どのパネルを、どこで使うか）。作業の途中で必要になったときは、止めて確認する。「規模と条件ごとの手順」で決まっている `feature-review`、`thermos`、`interrogate` は確認なしで回す。

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

- パネル系（architect、interrogate、arena）では、出す側（Grok Bot、Project、クラウドエージェント、worker）が、各モデルに出す前に自分の完全な案を書いて固めておく。返ってきた案はその案と並べて、全案が一致する点と割れている点に分けて統合する。判断・文章・まとめの役は、Grok Bot が担える場面では Grok Bot 自身がやる。

### 読み込み方

クラウドエージェントでは、pstack のスキルファイルは `~/.cursor/plugins/cache/` 配下にあるが、一覧に出るのは `setup-pstack` だけで、`poteto-mode` などは出ない。使うときは `ls ~/.cursor/plugins/cache/*/*/*/skills/poteto-mode/SKILL.md` でパスを探して Read し、必要なスキルも同じ `skills/` 配下から Read する。

## 実装

- 引数をoptional（`?:`）にしていいのは、省略すると「無効」か「通常動作」になると決まっているフラグだけ。それ以外の場合や、指定忘れが事故になる場合は、`T | undefined` か `T | null` でrequiredにする。DB schema、Zod、外部ライブラリの型は除く。
- アプリ内で定義した値、関数、型を、アプリ内の別箇所から再exportしない。
- console.logやコメントアウトは勝手に消さない。
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
- 録画やスクリーンショットで足りない画面の確認と、外部サービス連携の仕様を変えたときの実環境の確認は、seno が手動で行う。
- 計算や状態遷移の規則は単体テストで確認する。
- 状態によって画面に出る内容は e2e で確認する。状態ごとのデータを用意し、外部サービスはモックする。
- ブラウザ確認は、localhost で再現できるときはデプロイしない（クラウドエージェントも自分の環境の localhost で確認する）。
- 外部サービスの ID（決済のテスト用 ID など）は確認で消費しない。
- テスト用データを書き換えるブラウザ確認は、同時に一つだけ行う。
