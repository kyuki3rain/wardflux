# wardflux MVP 設計

`concept.md` のルールを実装し、**ゲームバランス・面白さの検証**を回すための MVP アプリケーション設計。

## 0. 設計ゴール（この設計が満たすべきこと）

1. **全アクションをコマンド化** — プレイヤーの操作はすべて 1 つの `Command`（直列化可能なデータ）になる。
2. **疎結合な処理** — ルールは純粋関数のエンジン 1 箇所に集約。UI / サーバ / シミュレータはエンジンを「呼ぶだけ」で、ルールを知らない。
3. **決定論的 & リプレイ可能** — `seed + コマンド列` から盤面を完全再現できる。バグ再現とバランス分析の土台。
4. **同一エンジンを共有** — オンライン対戦（権威サーバ）とボット一括シミュレーションが、まったく同じルール実装を使う。
5. **GitHub Pages で公開** — フロントは静的 SPA。対戦サーバは PartyKit に別途デプロイ。

---

## 1. 技術スタック

| 領域 | 採用 | 理由 |
|------|------|------|
| 言語 | **TypeScript**（全レイヤ統一） | `concept.md §19` がすでに TS 型。クライアント/サーバ/シミュレータでルールを 1 実装共有できる |
| モノレポ | **pnpm workspaces** | 軽量。`core` を各パッケージから参照 |
| ゲームエンジン | **純粋 TS（依存ゼロ）** | クリーンアーキテクチャの domain 層。フレームワーク非依存 |
| フロント | **React + Vite** | 静的ビルド → GitHub Pages。シンプルで実績十分 |
| 状態管理 | Zustand（軽量）+ PartySocket | 大げさな状態管理は不要 |
| オンライン対戦 | **PartyKit** | ルーム=1 試合。WebSocket・Durable Object 永続化・再接続を内包 |
| シミュレータ | **Node CLI（tsx）** | `core` を import してボット対戦を大量実行 |
| テスト | **Vitest** | エンジンのルール単体テスト・ゴールデンリプレイ |
| CI/CD | **GitHub Actions** | web→gh-pages、server→`partykit deploy` |

> GitHub Pages は静的ホスティングなのでサーバを置けない。
> **フロント（GitHub Pages）→ WebSocket → PartyKit サーバ（partykit.dev 上）** という構成になる。
> フロントのビルド時に PartyKit のホスト URL を env で焼き込む。

---

## 2. モノレポ構成

```
wardflux/
├─ packages/
│  ├─ core/        # 純粋ゲームエンジン（依存ゼロ）★ルールの単一の真実
│  │  ├─ types.ts        # concept.md §19 の型
│  │  ├─ cards.ts        # MVP 12 枚のカード定義（データ）
│  │  ├─ decks.ts        # default(builtin) デッキ定義 + validateDeck
│  │  ├─ state.ts        # GameState / PlayerState / FacilityInstance
│  │  ├─ rng.ts          # シード付き PRNG（決定論の要）
│  │  ├─ commands.ts     # Command union（全アクション）
│  │  ├─ events.ts       # GameEvent union（演出・ログ用）
│  │  ├─ engine.ts       # reduce(state, command) → {state, events} | error
│  │  ├─ phases.ts       # ドロー/収益/維持費/判定の自動フェーズ
│  │  ├─ effects/        # 効果ハンドラ登録（型 → 処理）疎結合の核
│  │  │   ├─ build.ts        # 建設時奪取(around8/魅力度)・人生成
│  │  │   ├─ business.ts     # 営業効果(人生成/人移動)
│  │  │   └─ policy.ts       # 施策5種(減少/移動/収益停止/維持費増/撤去)
│  │  ├─ rules/          # win.ts(勝敗) steal.ts capacity.ts temp_effects.ts
│  │  ├─ view.ts         # GameState → PlayerView（手札の秘匿）
│  │  ├─ legal.ts        # 合法手の列挙（UI ハイライト & ボット用）
│  │  └─ index.ts
│  ├─ server/      # PartyKit サーバ（権威）。core を薄くラップ
│  │  └─ wardflux.server.ts
│  ├─ web/         # React + Vite。GitHub Pages へデプロイ
│  └─ sim/         # Node CLI。ボット対戦の大量実行 → 統計出力
│     ├─ bots/         # ランダム/経済型/略奪型 の戦略
│     └─ run.ts        # N 試合回して CSV/JSON 出力
├─ partykit.json
└─ pnpm-workspace.yaml
```

クリーンアーキテクチャ対応: `core`=domain、`server`/`web`/`sim`=adapter（inbound/outbound）、`partykit.json`/CI=bootstrap。

---

## 3. コマンドモデル（疎結合の中心）

すべての操作は直列化可能な `Command`。エンジンは `(state, command) → 結果` の純粋関数。

```ts
type Command =
  | { type: "build_facility"; cardInstanceId: string; pos: Pos }      // 建設
  | { type: "use_business_effect"; facilityId: string;               // 営業効果
      move?: { toFacilityId: string } }                              //  人移動なら移動先
  | { type: "play_policy"; cardInstanceId: string; targets: PolicyTargets } // 施策
  | { type: "end_turn" };                                            // ターン終了

// エンジン本体（純粋・決定論的）
function reduce(state: GameState, cmd: Command):
  { ok: true; state: GameState; events: GameEvent[] } |
  { ok: false; error: RuleError };
```

ポイント:

- **検証もエンジン内**。資金マイナス・容量超過・魅力度不足・対象不正などはすべて `reduce` が `error` を返す。UI/サーバは判定ロジックを持たない。
- **効果ハンドラ登録（registry）**。`effects/` で「効果 type → ハンドラ関数」を登録。`reduce` は type で dispatch するだけ。新カードは原則 **データ追加**、新効果のときだけハンドラを 1 個足す → 疎結合。
- **events を返す**。`PEOPLE_STOLEN` `REVENUE_GAINED` `FACILITY_REMOVED` などを emit。UI はこれでアニメーション、`sim` はこれで統計、ログはこれでリプレイ。状態差分の再計算が要らない。
- **自動フェーズ**。`end_turn` を受けると `収益 → 維持費 → 勝敗判定 → 手番交代 → 次プレイヤーのドロー`（§11）をエンジン内で連続解決し、その過程の events をまとめて返す。

### 決定論 / RNG

- シャッフルと先攻後攻は **シード付き PRNG**（`state.rng` に内包）。ランダムを使うコマンドは state 内 PRNG から消費 → 同じ seed + 同じコマンド列 = 同じ盤面。
- これにより **リプレイ / バグ再現 / バランス再現** が無料で手に入る。コマンドログを保存するだけ。

---

## 4. オンライン対戦（PartyKit）

### 権威サーバ + 秘匿情報

カードゲームは手札が隠し情報。素朴な broadcast は手札を漏らすので、**接続ごとに `PlayerView`（自分の手札のみ実体、相手は枚数だけ）を送る**。

```
client ──{kind:"command", command}──▶  PartyKit room
                                        │ engine.reduce で検証・適用（権威）
                                        │ state を storage に永続化（再接続用）
        ◀─{kind:"state", view, ver}───┤ 接続ごとに redact した view を送信
        ◀─{kind:"events", events}─────┘ 演出用の差分イベント
```

### メッセージ протокол

- Client→Server: `join(name)` / `ready` / `command(Command)` / `request_sync`
- Server→Client: `lobby(players, config)` / `state(view, version)` / `events([...])` / `error(msg)` / `game_over(result)`

### ルーム = 1 試合

1. ホストがルーム作成 → **ルームコード**（= PartyKit room id）を共有。
2. 参加者が join。ホストが **設定**（初期資金 8/10/12、勝利ライン 25/30、デッキ、同名上限 3/4）を調整 → バランス検証に直結。
3. 2 人揃ってホストが start → サーバが seed・デッキ・初期手札を確定しエンジン初期化。
4. 観戦は公開 view のみの read-only で許可。
5. **再接続**: state を PartyKit storage に永続化。落ちても room 復帰時に現在 view を再送。

> 人数はエンジンが N 人対応で実装。今は UI/マッチングを 2 人に固定（決定事項）。
> 勝敗ルールも 2 人前提（`concept.md` の「両者」比較）のまま。

---

## 5. ボットシミュレーション（バランス検証）

`core` の同一エンジンを Node で回す。UI 不要、数千試合を高速実行。

```ts
type Bot = (view: PlayerView, legal: Command[]) => Command;  // 方策関数
```

- `legal.ts` の **合法手列挙**を共有（UI のハイライトとボットで同じ実装）。
- 初期ボット: `random-legal`（合法手ランダム）/ `greedy-economy`（収益最大化）/ `aggressive-steal`（略奪重視）。
- 収集メトリクス → CSV/JSON:
  - 先攻/後攻 勝率（§21-12）、平均ターン数、平均資金推移
  - どの勝利条件で決着したか（資金破綻 vs 人トークン30）
  - カード別の使用率・勝利寄与、容量・魅力度差の発生頻度
  - 設定（初期資金・勝利ライン）を振ったときの分布
- 出力はコマンドログ付き → 面白い試合をフロントの **リプレイビューア**で再生可能。

これで `concept.md §21`「検証したいこと 1〜12」をデータで回せる。

---

## 6. フロント（GitHub Pages）

- **ルーム作成 / 参加**（コード入力）画面 → ロビー（設定・ready）→ 5×5 盤面の対戦画面。
- 盤面: クリックで建設位置・営業効果・施策対象を選択 → `Command` を 1 つ送るだけ。**ルール判定はしない**（合法手ハイライトのみ `legal.ts` を使用）。
- `events` 受信でアニメーション（奪取・収益・撤去）。
- **リプレイビューア**: コマンドログを読み込み再生（sim の試合 / 対戦ログ共通）。
- ビルド: `vite build`（base = リポジトリ名）→ Actions で `gh-pages` へ。env に PartyKit ホスト URL。

---

## 6.5 デッキ構築（デッキビルダー）

`concept.md §3`（デッキ枚数・同名上限。現行は DEFAULT_RULESET で 30枚）に沿ったデッキを、プレイヤーが自分で組めるようにする。

### 保存はすべて localStorage

- サーバ/DB は使わない。ユーザーが作ったデッキは **ブラウザの localStorage** に保存。
- データはバージョン付き JSON。スキーマ変更に備える。

```ts
type Deck = {
  id: string;            // ローカル生成 UUID
  name: string;
  cardIds: string[];     // core の cardId を列挙（30枚）
  builtin?: boolean;     // default デッキは true（編集不可・複製のみ可）
};

type DeckExport = {       // export/import で受け渡す文字列の中身
  format: "wardflux-deck";
  version: 1;
  deck: Omit<Deck, "id" | "builtin">;  // name + cardIds
};
// localStorage キー: "wardflux:decks" に Deck[] を JSON 保存
```

### export / import（文字列 = JSON）

- **export**: 選択デッキを `DeckExport` の JSON 文字列にして表示（コピー用）/ クリップボード。
- **import**: JSON 文字列を貼り付け → `core` でバリデーション（後述）→ 新規 id を振って localStorage に追加。
- フォーマット検証: `format`/`version` チェック、未知 `cardId` 拒否、枚数・同名上限チェック。
- これにより DB なしでデッキを共有でき、バランス検証用の「お題デッキ」も配布できる。

### デッキの妥当性検証（core 側）

`core` に `validateDeck(deck, ruleset): DeckError[]` を置き、ビルダー・import・対戦開始の 3 箇所で共通利用（疎結合）。

- 合計 **30枚**（ruleset で可変。`§3` の原案は20枚）
- **同名上限 3/4**（`§16`、ruleset で可変）
- 全 `cardId` が `cards.ts` に存在

### デッキビルダー画面

- 左: カードプール（MVP 12枚、施設/施策・カテゴリでフィルタ、ステータス表示）。
- 右: 現在のデッキ（枚数・同名カウント・妥当性インジケータ）。
- 操作: 追加/削除、名前変更、保存、複製、削除、**Export（文字列表示）**、**Import（文字列貼り付け）**。
- default デッキ（builtin）は編集不可 → 「複製して編集」で自分のデッキ化。

### デッキ選択画面（対戦ロビー導線）

ロビーで使うデッキを選ぶ画面に並ぶのは:

1. **default デッキ（builtin）** — `core` に同梱する組み済みデッキ（バランス検証の基準デッキ。最低 1〜2 個）。
2. **ユーザーデッキ** — デッキビルダーや import で作成し localStorage に入っているデッキ群。

> ロジック: `availableDecks = [...builtinDecks, ...localStorageDecks]`。
> localStorage が空でも default が必ず出るので、初見でもすぐ対戦に入れる。
> 選択デッキは妥当性 OK のもののみ「対戦開始」可能（`validateDeck` で再チェック）。

default デッキ定義は `core/decks.ts` に置き、`web` と `sim`（ボット）双方が同じ基準デッキを使える。

---

## 7. デプロイ / CI

- `web`: GitHub Actions → `gh-pages` ブランチ（または Pages Actions）。`VITE_PARTYKIT_HOST` を build 時注入。
- `server`: `partykit deploy` で安定 URL 取得 → 上記 env に設定。
- `core`: `pnpm test`（Vitest）を CI ゲートに。
- PR 時にエンジンのゴールデンリプレイテストを実行し、ルール退行を検出。

---

## 8. 実装フェーズ（提案）

1. **エンジン中核（TDD）** — types/state/rng/cards、建設・奪取(around8/魅力度)・容量・収益・維持費・勝敗判定。単体テストで `§21` のルール挙動を固める。
2. **コマンド & 効果ハンドラ** — 営業効果2種・施策5種・一時効果・撤去。`reduce` 完成。
3. **sim CLI** — 合法手列挙 + ランダムボットで「最後まで破綻なく試合が回る」ことを担保 → 最初のバランス数値を出す。
4. **PartyKit サーバ** — 権威ループ・view 秘匿・ロビー・再接続。
5. **web** — デッキビルダー（export/import・localStorage）→ デッキ選択 → ロビー + 盤面 + events 演出。
6. **リプレイ & GitHub Pages 公開** — CI、設定振りのバランス回し。

エンジン（1〜3）が最優先。ここが固まればオンライン対戦もシミュレーションも同じ土台で乗る。

---

## 9. 主要な設計判断（要確認ポイント）

- **2人固定 / N人対応エンジン**（決定済み）
- **権威サーバ + 接続ごと view 秘匿**（手札漏洩防止のため必須）
- **seed 付き決定論エンジン**（リプレイ・バランス再現のため）
- **効果はデータ + 型 dispatch**（`concept.md §19` の型を踏襲。自由記述しない）
- 初期資金・勝利ライン・同名上限はロビーで可変 → 検証パラメータ化
```
