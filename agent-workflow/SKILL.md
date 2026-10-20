---
name: agent-workflow
description: git・ブランチ・デプロイ、テスト、UI、TypeScript/React 実装、pstack とモデル選定の手順。コード変更、レビュー、画面実装、検証、デプロイを行うときに使う。
---

# agent-workflow

このスキルを使うときは、作業の種類に関係なく、同じディレクトリの `dev-workflow.md`、`implementation.md`、`pstack.md` の3つを Read してから作業する。子ファイルは自動では読み込まれない。

- リポジトリの `.cursor/rules`、`.cursor/skills`（例: `verify-screen`）、Project の `preferences.md` があれば、そちらをグローバルより優先する。ブランチ名、ホスト名、デプロイ手順の具体はそちらにある想定で、このディレクトリの一般原則と矛盾したらプロジェクト側を優先する。
