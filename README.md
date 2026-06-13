# wardflux

都市人流カードゲームの MVP。ゲームバランスと面白さを検証するためのアプリケーション。
ルールは [`docs/concept.md`](docs/concept.md)、設計は [`docs/design.md`](docs/design.md) を参照。

## アーキテクチャ

全アクションを `Command`（直列化可能データ）化し、純粋関数エンジンで処理する疎結合構成。
同一エンジンをオンライン対戦・ボットシミュレーション・UI で共有する。

```
packages/
  core    純粋ゲームエンジン（依存ゼロ・決定論）★ルールの単一の真実
  server  PartyKit 権威サーバ（ロビー / 手札秘匿 / 再接続）
  web     React + Vite（デッキビルダー / ロビー / 盤面） → GitHub Pages
  sim     ボット対戦の大量シミュレーション → バランス指標
```

## 必要環境

- Node.js 20+
- pnpm（`corepack enable && corepack prepare pnpm@latest --activate`）

```bash
pnpm install
```

## 開発

```bash
# オンライン対戦をローカルで動かす（2つのターミナル）
pnpm dev:server     # PartyKit を 127.0.0.1:1999 で起動
pnpm dev:web        # Vite を起動（既定で 127.0.0.1:1999 のサーバに接続）

# テスト / 型チェック
pnpm test           # core のルール単体テスト（38件）
pnpm typecheck      # 全パッケージ
```

ブラウザでルームを作成し、表示されたルームコード（または招待リンク）で2人目が参加 → 各自デッキ選択 → 準備完了 → ホストが開始。

## バランス検証（ボットシミュレーション）

```bash
# ボット同士を多数対戦させ、先攻勝率・平均ターン・決着理由を集計
pnpm sim -- --games 500 --p1 greedy-economy --p2 aggressive-steal

# パラメータを振って検証（初期資金・勝利ライン）
pnpm sim -- --games 400 --funds 12 --winline 25 --csv   # CSV を sim-out/ へ
```

ボット: `random` / `greedy-economy` / `aggressive-steal`。
デッキ: `--deck1 / --deck2` に `builtin-balanced` / `builtin-aggro`。

## デプロイ

- **web** → GitHub Pages（`.github/workflows/deploy.yml`）
  - Settings > Pages > Source = GitHub Actions
  - リポジトリ変数 `VITE_PARTYKIT_HOST` にデプロイ済み PartyKit ホストを設定
- **server** → PartyKit
  ```bash
  pnpm deploy:server          # 初回は partykit login が必要
  ```
  CI で自動化する場合はシークレット `PARTYKIT_TOKEN` を設定。

## デッキの共有

デッキビルダーで作成したデッキは localStorage に保存され、JSON 文字列で Export / Import できる。
`builtin`（default）デッキは編集不可（複製して編集）。
