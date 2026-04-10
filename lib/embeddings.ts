/**
 * Google Gemini Embeddings API を使った文書ベクトル化・類似度計算モジュール。
 *
 * Embedding（埋め込み）とは:
 *   テキストを高次元の実数ベクトルに変換したもの。意味的に近い文章ほど
 *   ベクトル空間上で近い位置に配置される。これにより「同じ意味でも別の言い回し」
 *   をした重複記事を検出できる。
 */

import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";

// モジュール内でクライアントをシングルトン管理する。
// 理由: Next.js の Server Components / Route Handlers は各リクエストで
// モジュールを再評価しないが、念のため遅延初期化にしておくことで
// GEMINI_API_KEY が設定されていない環境でもモジュール読み込み自体は成功する。
let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  }
  return genAI;
}

/**
 * テキストを 768 次元の embedding ベクトルに変換する。
 *
 * モデル選定: `text-embedding-004`
 *   - Gemini の最新安定 Embedding モデル（2024 年時点）
 *   - 768 次元（OpenAI text-embedding-3-small は 1536 次元）
 *   - MTEB ベンチマークで高いスコアを記録しており、多言語対応
 *   - 無料枠が OpenAI より広く、コスト効率に優れる
 *
 * TaskType.SEMANTIC_SIMILARITY を使う理由:
 *   Gemini のモデルは用途（タスク）に応じて最適化されたベクトルを生成する。
 *   - SEMANTIC_SIMILARITY: 文章同士の意味的な近さを測定する用途。
 *     重複チェック（dedup）と意味検索（semantic search）の両方に適している。
 *   - RETRIEVAL_DOCUMENT / RETRIEVAL_QUERY: 文書検索に特化した pair 型。
 *     ドキュメント側とクエリ側で別のタスクタイプを使う必要があり、
 *     DB に保存したベクトルの互換性管理が複雑になる。
 *   → 本アプリでは同一のベクトルを dedup と search 両方に使うため、
 *     SEMANTIC_SIMILARITY に統一してシンプルさを優先する。
 *
 * text.slice(0, 2000) の理由:
 *   text-embedding-004 のトークン上限は 2048 tokens。
 *   日本語は 1 文字 ≈ 1〜2 tokens のため、2000 文字で安全に収まる。
 *   長い記事の場合は冒頭部分（タイトル + 前半）で意味を十分捉えられる。
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: "gemini-embedding-001" });

  const result = await model.embedContent({
    content: { parts: [{ text: text.slice(0, 2000) }], role: "user" },
    taskType: TaskType.SEMANTIC_SIMILARITY,
  });

  // result.embedding.values が float[] 形式の 768 次元ベクトル
  return result.embedding.values;
}

/**
 * 2 つのベクトル間のコサイン類似度を計算する。
 *
 * 数式: cos(θ) = (A · B) / (|A| × |B|)
 *
 * 計算手順:
 *   1. 内積 (dot): Σ a_i × b_i
 *   2. ノルム (normA, normB): Σ a_i² → √ で開く
 *   3. dot / (√normA × √normB)
 *
 * なぜコサイン類似度か:
 *   - ベクトルの大きさ（文章の長さ）に依存せず方向（意味）だけを比較できる
 *   - 値の範囲は [-1, 1]。Embedding ベクトルは正規化されているため実際は [0, 1] 付近
 *   - pgvector の <=> 演算子（コサイン距離）と等価なので、
 *     将来 pgvector に移行した場合もロジックが一致する
 *   - ベクトルの次元数（768 or 1536）に関係なく同じ計算式が成立する
 *
 * denom === 0 のガード:
 *   ゼロベクトルとの類似度は定義できないため 0 を返す。
 *   通常の Embedding では発生しないが、空文字列など異常入力への安全策。
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i]; // 二乗和を累積（後で √ を取る）
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * 意味的重複とみなす類似度の閾値。
 *
 * 0.9 を選んだ理由:
 *   - 0.95 以上: ほぼ同一文（コピペ）→ 物理チェック（ハッシュ）で十分
 *   - 0.85〜0.95: 同トピックの別記事 → ここが「意味的重複」の主な対象
 *   - 0.75〜0.85: 関連記事（同カテゴリ） → リンクで繋ぐべき別記事
 *   - 0.9 はこれらのバランスを取った経験的な値。
 *     モデルを変更した場合は実際の記事で検証して調整すること。
 *     （Gemini と OpenAI はベクトル空間の分布が異なるため再調整が必要な場合がある）
 *
 * 注意: OpenAI から Gemini へ移行した場合、DB に保存済みの embedding は
 * 互換性がない（次元数が 1536 → 768 に変わる）。
 * 既存の embedding は再生成が必要。
 */
export const SIMILARITY_THRESHOLD = 0.9;

/**
 * Gemini API キーが設定されているかを確認するヘルパー。
 * API キーなしでも基本的な CRUD は動作するよう、
 * Embedding 関連処理はすべてこのフラグで条件分岐している。
 */
export const hasEmbeddingSupport = () => !!process.env.GEMINI_API_KEY;
