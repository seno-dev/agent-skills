# pstack の使い方（コスト抑制）

pstack のスキル（`poteto-mode` など）は、Cursor Project、Project の worker、クラウドエージェント、それらが出すサブエージェントのどれでも、以下の内容に従って使う。モデルはこのファイルの「モデル」に従い、pstack の既定より優先する。

## カテゴリごとの使い方

| カテゴリ | 条件 | 使い方 |
|------|------|----------|
| A | 大規模、または間違えたときの損が大きい領域 | `/poteto-mode` の作業・検証の型に従う。develop へ merge する前に `interrogate` を 1 回行う |
| B | 中規模 | `/poteto-mode` の作業・検証の型に従う |
| C | 小規模 | `/poteto-mode` とすべてのパネル系は使わない。必要なら `typescript-best-practices` など、サブエージェントを出さないスキルだけ読む |

- A のうち、互いに別のファイルや経路を触る作業が 3 つ以上に分けられるときだけ Cursor Project を立ち上げて任せる。それ以外は 1 つのクラウドエージェントが機能ブランチで、検証できる区切りごとにコミットして進める。迷ったら後者にする。
- 検証はリポジトリの `verify-*` スキル（例: `verify-screen`）と録画を優先する。
- `reflect`、`correct`、`automate-me`、`setup-pstack` は頼まれたときだけ。

## モデル

- 前提: pstack の「hardest tasks」の対象には、デフォルトの「複数の箇所にまたがる設計、込み入った並行処理、細かな誤りに気づきにくいアルゴリズム」に加え、間違えたときの損が大きい領域（決済、認証、migration、医療データの書き込みなど。具体的な一覧は各リポジトリの `.cursor/rules`）も含むものとする。
- Project やクラウドエージェントが worker やサブエージェントを出すときは、以下の表にある役ならそれに従い、なければ grok-4.7-medium を使う。`/setup-pstack` の規則ファイルは PC の `~/.cursor/rules` にしかなくクラウドには届かないので、クラウドではこの表を正とする。
- 文言やドキュメントの変更・push など手順が決まったタスクは composer-2.5 にする。
- 同じモデルで検証に 2 回落ちたら、同じモデルで再挑戦せず、1 段上のモデル（composer-2.5 → grok-4.7-medium → grok-4.7-high）で新しい worker かサブエージェントを出す。grok-4.7-high より上げるときは確認する。
- 複数のサブエージェントを並行して動かすパネル系（architect、interrogate、arena、swarm）を使う見込みの場合は、作業を始める前に Grok Bot がまとめて seno に確認する（どのパネルを、どこで使うか）。作業の途中で必要になったときは、止めて確認する。
- fast モードと xhigh は事前確認なしに使わない。opus は下の表のパネルの役でだけ使う。

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
- 間違えたときの損が大きい領域では、パネルの claude-opus-5-5-medium を claude-opus-5-5-high に上げる。

## 読み込み方

クラウドエージェントでは、pstack のスキルファイルは `~/.cursor/plugins/cache/` 配下にあるが、一覧に出るのは `setup-pstack` だけで、`poteto-mode` などは出ない（`disable-model-invocation: true` のため）。使うときは `ls ~/.cursor/plugins/cache/*/*/*/skills/poteto-mode/SKILL.md` でパスを探して Read し、必要なスキルも同じ `skills/` 配下から Read する。
