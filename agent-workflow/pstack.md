# pstack の使い方（コスト抑制）

pstack は作業者（クラウドエージェント、Cursor Project の worker）が使う。既定のままだと opus / xhigh と複数レビュアーを使うため、下の範囲に絞る。モデルは `dev-workflow.md` のモデル選定ルールに従い、pstack の既定より優先する。

## 規模ごとの使い方

| 規模 | 使う | 使わない |
|------|------|----------|
| 小 | 使わない。必要なら `typescript-best-practices` など、サブエージェントを出さないスキルだけ読む | `/poteto-mode` とすべてのパネル系 |
| 中 | `/poteto-mode`（作業の型と検証の型に従う） | `arena`、`swarm`、`interrogate` |
| 大（Project） | `/poteto-mode`。develop へ merge する前に `interrogate` を 1 体だけ | `arena`、`swarm` は seno が指定したときだけ |

- 検証はリポジトリの `verify-*` スキル（例: `verify-screen`）と録画を優先する。
- `reflect`、`correct`、`automate-me`、`setup-pstack` は頼まれたときだけ。
- 迷ったら軽い方にする。重くしたいときは理由を書いて確認する。

## モデルを上げる場所と下げる場所

- 規模に関係なく、間違えたときの損が大きい領域（決済、認証、migration、医療データの書き込みなど。具体的な一覧は各プロジェクトの preferences や bot の説明に書く）は、作業者を grok-4.7-medium 以上にし、develop へ merge する前に必ず `interrogate` を 1 体通す。上の表で中規模が `interrogate` を使わないことより、こちらを優先する。
- 読むだけの調査、文言やドキュメントの変更、スキルリポジトリへの push は composer-2.5 にする。
- 同じモデルで検証に 2 回落ちたら、同じモデルで再挑戦せず、1 段上のモデル（composer-2.5 → grok-4.7-medium → grok-4.7-high）で新しい作業者を出す。grok-4.7-high より上げるときは確認する。

## 役割ごとのモデル

`/setup-pstack` の規則ファイルは PC の `~/.cursor/rules` にしかなく、クラウドエージェントには届かない。クラウドではこの表を正とし、指示文に貼る。パネル系は 1 体まで。fast モード、xhigh、opus は事前確認なしに使わない。

```
# budget: small 相当（seno のモデル選定ルールに合わせる）
feature, refactoring: composer-2.5
bug-fix: composer-2.5
perf-issue: grok-4.7-medium
hillclimb: grok-4.7-medium
judgment and prose: inherit-parent
hardest tasks: grok-4.7-high
how explorer: composer-2.5
how explainer: inherit-parent
why investigators: composer-2.5
why synthesizer: inherit-parent
reflect tooling: composer-2.5
reflect judgment, divergent, synthesizer: inherit-parent
arena runners: composer-2.5
arena cross-judge pool: grok-4.7-medium
swarm workers: composer-2.5
architect runners: grok-4.7-high
interrogate reviewers: grok-4.7-high
```

## 読み込み方

クラウドエージェントでは、pstack のスキルファイルは `~/.cursor/plugins/cache/` 配下にあるが、一覧に出るのは `setup-pstack` だけで、`poteto-mode` などは出ない（`disable-model-invocation: true` のため）。使うときは `ls ~/.cursor/plugins/cache/*/*/*/skills/poteto-mode/SKILL.md` でパスを探して Read し、必要なスキルも同じ `skills/` 配下から Read する。

## 初回の確認

クラウドエージェントで pstack を初めて使うときは、作業者に pstack のスキル（`poteto-mode`）が読めるか最初に報告させる。読めなければ pstack なしで進め、その旨を報告させる。
