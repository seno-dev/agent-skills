# agent-skills

Cursor のエージェント用のグローバルスキルを置くリポジトリです。今は `agent-workflow/` だけがあります（文体、git・ブランチ・デプロイ、テスト、UI、実装のルール）。プロジェクト固有の設定（各 Project の `preferences.md` など）と、Secrets の値はこのリポジトリに置かない。

## PC（WSL）での設定

WSL のターミナルで、次を順に実行してください。

```bash
# 1. リポジトリを clone する
mkdir -p ~/src
git clone git@github.com:seno-dev/agent-skills.git ~/src/agent-skills

# 2. 既存の ~/.cursor/skills/agent-workflow があれば退避する（シンボリックリンクでも実体でも退避する）
mkdir -p ~/.cursor/skills
if [ -e ~/.cursor/skills/agent-workflow ] || [ -L ~/.cursor/skills/agent-workflow ]; then
  mv ~/.cursor/skills/agent-workflow ~/.cursor/skills/agent-workflow.bak-$(date +%Y%m%d%H%M%S)
fi

# 3. clone した agent-workflow を指すシンボリックリンクを作る
ln -s ~/src/agent-skills/agent-workflow ~/.cursor/skills/agent-workflow

# 4. 確認する（-> ~/src/agent-skills/agent-workflow と SKILL.md などが表示されれば完了）
ls -l ~/.cursor/skills/agent-workflow
ls ~/.cursor/skills/agent-workflow/
```

HTTPS で clone する場合は、1 の URL を `https://github.com/seno-dev/agent-skills.git` に置き換えてください（private のため、GitHub の認証が必要です）。

## 更新の流れ

1. `~/src/agent-skills/agent-workflow/` の md を編集する（シンボリックリンク経由の `~/.cursor/skills/agent-workflow/` を編集しても同じファイル）。
2. コミットして main に push する。

   ```bash
   cd ~/src/agent-skills
   git add -A
   git commit -m "agent-workflow: 変更内容"
   git push origin main
   ```

3. 別の場所（ほかの PC など）で編集したときは、PC 側で取り込む。

   ```bash
   cd ~/src/agent-skills && git pull
   ```

シンボリックリンクなので、`git pull` のあとは Cursor 側の追加作業は不要です。
