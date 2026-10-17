---
name: agent-workflow
description: 日本語の返答文体、git・ブランチ・デプロイ、テスト、UI、TypeScript/React 実装の手順。コード変更、PR、レビュー、画面実装、検証を行うときに使う。
---

# agent-workflow

このスキルは **同ディレクトリ内の Markdown を Read してから** 作業する。子ファイルは自動では読み込まれない。

## ルーティング

| 依頼の種類 | Read するファイル |
|------------|-------------------|
| 返答の文体・日本語・コミットメッセージ言語・WSL 等 | `general.md` |
| ブランチ、コミット、push、デプロイ、worker、モデル選定、migration、本番/開発の区別 | `dev-workflow.md` |
| 単体テスト、e2e、ブラウザ確認、verify スキル | `testing.md` |
| 画面文言、情報の順、共通ラッパー、利用者向け表現 | `ui.md` |
| TypeScript/React の型・optional・共通化・lint・migration コメント等 | `implementation.md` |

**コード実装・修正・PR を含む作業**では、少なくとも `dev-workflow.md` と `implementation.md` を Read する。利用者向けの説明やチャット返信を書くときは `general.md` も Read する。画面を触るときは `ui.md` を追加。テストを書く・検証方針を決めるときは `testing.md` を追加。

## プロジェクト固有

- リポジトリの `.cursor/skills/`（例: `verify-screen`）と Project の `preferences.md` があれば、**そちらをグローバルより優先**する。
- ブランチ名（`main` / `develop`）、ホスト名、デプロイ手順の具体はリポジトリまたは Project 設定に書かれている想定。グローバル `dev-workflow.md` の一般原則と矛盾したら **プロジェクト側を優先**する。

## User Rules との関係

User Rules に短い索引（「コード作業時は `agent-workflow` の SKILL.md に従い、必要な md を Read」）だけ残し、詳細はこのディレクトリに集約する設計向け。
