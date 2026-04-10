/**
 * グラフ構造に関するユーティリティ。
 *
 * 循環参照の検出は PREREQUISITE（前提条件）リンクにのみ適用する。
 * 理由：PREREQUISITE は「A を理解するには B が必要」という依存グラフを形成するため、
 * A→B→C→A のような循環があると「互いに前提」という論理矛盾になる。
 * DERIVATION・APPLICATION は意味的に循環してもよい（例：理論 A から B が派生し、
 * B の応用が A に戻る）ため、制約を課さない。
 */

/**
 * 新しいエッジを追加したとき PREREQUISITE グラフに閉路（循環参照）が生じるかを検出する。
 *
 * アルゴリズム: 深さ優先探索（DFS）による有向グラフの閉路検出
 *
 * 考え方:
 *   - visited   : 一度でも訪問済みのノード集合（再訪問を防ぐ）
 *   - inStack   : 現在の DFS コールスタック上にあるノード集合
 *   - inStack に含まれるノードへ再び到達 → その経路が閉路
 *
 * なぜトポロジカルソートではなく DFS か:
 *   トポロジカルソートも閉路検出に使えるが、DFS は閉路発見時点で即座に打ち切れるため
 *   早期リターンの実装が自然。記事数が増えても O(V+E) で動作する。
 *
 * @param existingEdges 既存の PREREQUISITE エッジ一覧
 * @param newEdge       追加しようとしている新しいエッジ
 * @returns true なら循環参照が発生する
 */
export function wouldCreateCycle(
  existingEdges: Array<{ sourceId: string; targetId: string }>,
  newEdge: { sourceId: string; targetId: string }
): boolean {
  // 新エッジを含む隣接リストを構築する。
  // Set を使うのは、同じ (source, target) ペアが既にある場合に重複を無視するため。
  const adj = new Map<string, Set<string>>();

  for (const edge of [...existingEdges, newEdge]) {
    if (!adj.has(edge.sourceId)) adj.set(edge.sourceId, new Set());
    adj.get(edge.sourceId)!.add(edge.targetId);
  }

  const visited = new Set<string>();
  // inStack はバックエッジ（祖先への辺）を検出するために必要。
  // visited だけでは「別経路で既訪問のノード」と「同一スタック上のノード」を区別できない。
  const inStack = new Set<string>();

  function dfs(node: string): boolean {
    visited.add(node);
    inStack.add(node);

    for (const neighbor of adj.get(node) ?? []) {
      if (!visited.has(neighbor)) {
        // 未訪問 → 再帰的に探索
        if (dfs(neighbor)) return true;
      } else if (inStack.has(neighbor)) {
        // 訪問済み かつ スタック上 → バックエッジ = 閉路を発見
        return true;
      }
      // 訪問済み かつ スタック外 → 別経路で探索済みなので無視（クロスエッジ）
    }

    // このノードの全子孫の探索が完了したのでスタックから外す
    inStack.delete(node);
    return false;
  }

  // 隣接リストに現れる全ノードを起点に探索（非連結グラフ対応）
  for (const node of adj.keys()) {
    if (!visited.has(node) && dfs(node)) return true;
  }
  return false;
}

/** DB の enum 値と同じ文字列リテラル型。型安全のために共通定義する。 */
export type LinkType = "PREREQUISITE" | "DERIVATION" | "APPLICATION";

/** UI に表示する日本語ラベル。DB の enum キーと 1:1 対応。 */
export const LINK_TYPE_LABELS: Record<LinkType, string> = {
  PREREQUISITE: "前提条件",
  DERIVATION: "派生",
  APPLICATION: "活用事例",
};

/**
 * グラフ上でエッジを色分けするための Tailwind / CSS カラー値。
 *
 * 色の選定理由:
 *   - PREREQUISITE (#ef4444 赤系): 「必須・制約」を連想させる警告色
 *   - DERIVATION   (#3b82f6 青系): 技術の系譜・論理的連鎖を連想させるクール色
 *   - APPLICATION  (#22c55e 緑系): 実用・成果を連想させるポジティブ色
 *
 * 値は Tailwind CSS v4 の red-500, blue-500, green-500 に相当する16進コード。
 * インラインスタイルでも使えるよう Tailwind クラスではなく生の hex を保持している。
 */
export const LINK_TYPE_COLORS: Record<LinkType, string> = {
  PREREQUISITE: "#ef4444",
  DERIVATION: "#3b82f6",
  APPLICATION: "#22c55e",
};
