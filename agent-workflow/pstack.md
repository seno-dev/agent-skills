# pstack の使い方（コスト抑制）

pstack のスキル（`poteto-mode` など）は、Cursor Project、Project の worker、クラウドエージェント、それらが出すサブエージェントのどれでも、以下の内容に従って使う。既定のままでは opus や xhigh、複数のレビュアーを使ってコストが高くなるので、ここに書いた範囲に絞る。モデルはこのファイルの「モデル」に従い、pstack の既定より優先する。

## 規模ごとの使い方

| 規模 | 使う | 使わない |
|------|------|----------|
| 小 | 使わない。必要なら `typescript-best-practices` など、サブエージェントを出さないスキルだけ読む | `/poteto-mode` とすべてのパネル系 |
| 中 | `/poteto-mode`（作業の型と検証の型に従う） | `arena`、`swarm`、`interrogate` |
| 大（Project） | `/poteto-mode`。develop へ merge する前に `interrogate` を 1 体だけ | `arena`、`swarm` は seno が指定したときだけ |

- 間違えたときの損が大きい領域では、規模に関係なく develop へ merge する前に `interrogate` を 1 体通す。
- 検証はリポジトリの `verify-*` スキル（例: `verify-screen`）と録画を優先する。
- `reflect`、`correct`、`automate-me`、`setup-pstack` は頼まれたときだけ。
- 迷ったら軽い方にする。

## モデル

### 上げる場所と下げる場所
- Project が worker を出すときと、クラウドエージェントや worker がサブエージェントを出すときは、grok-4.7-medium を既定とする（サブエージェントは、表にある役なら表に従う）。次の2つでは、worker と、実装・判断・レビューの役のサブエージェントを grok-4.7-high にする（調べ役は表のまま）。
  - いちばん難しい作業（複数の境界をまたぐ設計、並行動作、誤りが目立たないアルゴリズム）
  - 間違えたときの損が大きい領域（決済、認証、migration、医療データの書き込みなど。具体的な一覧は各リポジトリの `.cursor/rules`）
- 読むだけの調査、文言やドキュメントの変更、スキルリポジトリへの push は composer-2.5 にする。
- 同じモデルで検証に 2 回落ちたら、同じモデルで再挑戦せず、1 段上のモデル（composer-2.5 → grok-4.7-medium → grok-4.7-high）で新しい worker かサブエージェントを出す。grok-4.7-high より上げるときは確認する。
- パネル系は 1 体まで。fast モードと xhigh は事前確認なしに使わない。opus は下の表のパネルの役でだけ使う。

### サブエージェントの役ごとのモデル
クラウドエージェントがサブエージェントを出すときも、worker がサブエージェントを出すときも、この表に従う。`/setup-pstack` の規則ファイルは PC の `~/.cursor/rules` にしかなくクラウドには届かないので、クラウドではこの表を正とする。

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
reflect tooling: composer-2.5
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
