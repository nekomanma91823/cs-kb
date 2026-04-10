/**
 * Canvas ベースのナレッジグラフ可視化コンポーネント。
 *
 * なぜ Canvas（2D）か:
 *   - react-force-graph（three.js ベース）は React 19 との互換性リスクがある
 *   - SVG はノード数が増えると DOM 要素が肥大化してパフォーマンスが低下する
 *   - Canvas は全描画をピクセル操作で行うため、ノード数が増えても一定のパフォーマンス
 *   - D3 ライブラリ自体はインポートせず、力学シミュレーションを自前実装している
 *     （バンドルサイズ削減 + React 19 との干渉なし）
 *
 * 力学シミュレーション（Force-Directed Layout）の概要:
 *   各ノードを物理粒子として扱い、以下の力を加えることで自然な配置を得る:
 *   1. バネ力（Spring）: リンクで繋がったノードを適切な距離に引き合わせる
 *   2. 反発力（Repulsion）: すべてのノードペアが互いに反発して重ならないようにする
 *   3. 重力（Center Gravity）: ノードがキャンバス中央付近に留まるよう引き寄せる
 */

"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { LINK_TYPE_COLORS, LINK_TYPE_LABELS, type LinkType } from "@/lib/graph-utils";
import { useTheme } from "@/lib/theme";
import { Tag, X, ChevronDown, Check } from "lucide-react";

/** シミュレーション中に変化するノードの位置・速度を含む拡張型 */
interface GraphNode {
  id: string;
  title: string;
  tags: string[];
  x?: number;
  y?: number;
  vx?: number;  // x 方向の速度
  vy?: number;  // y 方向の速度
  fx?: number | null; // ドラッグ中に固定する x 座標（null = 固定解除）
  fy?: number | null; // ドラッグ中に固定する y 座標
}

interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  linkType: LinkType;
}

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * ノードの円の半径（px）。
 * 22px: クリックしやすい最小サイズと、ラベルが収まるサイズのバランス。
 */
const NODE_RADIUS = 22;

/**
 * ノード間の反発力の強さ（負の値 = 反発）。
 * -400: 各ノードペアに -400 / distance² の力を加える。
 * 絶対値を大きくするほどノードが広がり、小さくすると密集する。
 * 400 はノード半径 22px に対してちょうど重ならない程度の経験値。
 */
const REPULSION = -400;

/**
 * リンクで繋がったノード間の目標距離（px）。
 * 120px: NODE_RADIUS(22) × 2 + ラベルと矢印の余白。
 * これより近いと引き離し、遠いと引き寄せるバネとして機能する。
 */
const LINK_DISTANCE = 120;

/**
 * コンテナ要素のサイズを ResizeObserver で追跡するカスタムフック。
 * ウィンドウリサイズ時に Canvas を動的に追従させるために使う。
 * useState ではなく useRef でも良いが、サイズ変更を再描画に繋げるには
 * 状態（useState）として持つ必要がある。
 */
function useDimensions(ref: React.RefObject<HTMLDivElement | null>) {
  const [dims, setDims] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setDims({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(el);
    // 初期サイズを即座に設定（observer は非同期なので最初のレンダリングをカバー）
    setDims({ width: el.clientWidth, height: el.clientHeight });
    return () => observer.disconnect();
  }, [ref]);
  return dims;
}

export function KnowledgeGraph({ nodes: rawNodes, edges: rawEdges }: Props) {
  const router = useRouter();
  const isDark = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  // ---- タグフィルタ ----
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState("");

  // 全ノードから重複排除してタグ一覧を生成（五十音順）
  const allTags = useMemo(
    () => [...new Set(rawNodes.flatMap((n) => n.tags))].sort((a, b) => a.localeCompare(b, "ja")),
    [rawNodes]
  );

  // パネル内検索で絞り込んだタグ一覧
  const visibleTags = useMemo(
    () => allTags.filter((t) => t.toLowerCase().includes(tagSearch.toLowerCase())),
    [allTags, tagSearch]
  );

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  // 選択タグが 0 件 → 全ノード表示。1 件以上 → いずれかのタグを持つノードのみ表示。
  const filteredNodes = useMemo(
    () =>
      selectedTags.length === 0
        ? rawNodes
        : rawNodes.filter((n) => n.tags.some((t) => selectedTags.includes(t))),
    [rawNodes, selectedTags]
  );

  // フィルタ後のノード ID セット（エッジの絞り込みに使う）
  const filteredNodeIds = useMemo(
    () => new Set(filteredNodes.map((n) => n.id)),
    [filteredNodes]
  );

  // 両端ノードがどちらもフィルタ後に残っているエッジのみ表示
  const filteredEdges = useMemo(
    () => rawEdges.filter((e) => filteredNodeIds.has(e.sourceId) && filteredNodeIds.has(e.targetId)),
    [rawEdges, filteredNodeIds]
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { width, height } = useDimensions(containerRef);

  // シミュレーション状態は useRef で管理する。
  // 理由: 毎フレーム変化する座標・速度を useState に入れると毎フレーム再レンダリングが
  // 走ってしまう。useRef なら値の変更が React のレンダリングサイクルを経由しない。
  const simNodes = useRef<GraphNode[]>([]);
  const dragging = useRef<{ node: GraphNode; offsetX: number; offsetY: number } | null>(null);
  // mousedown 後にマウスが実際に動いたかどうかのフラグ。
  // true になった場合のみドラッグ扱いにし、false のままなら mouseup をクリックとして処理する。
  const hasMoved = useRef(false);

  // パン・ズームのビュー変換（Canvas の座標系オフセット）
  // x, y: 平行移動量、scale: 拡大率
  const transform = useRef({ x: 0, y: 0, scale: 1 });

  // ツールチップは React の状態として管理（表示/非表示で DOM 変更が必要）
  const [tooltip, setTooltip] = useState<{ x: number; y: number; title: string } | null>(null);

  /**
   * rawNodes が変更されたとき（または Canvas サイズが確定したとき）に
   * シミュレーションノードを初期化する。
   *
   * 初期配置を円形に配置する理由:
   *   ランダム配置より均等に広がるため、シミュレーション収束が速くなる。
   *   Math.cos/sin で i/N * 2π の角度を使い円周上に均等配置。
   *   半径 150px は NODE_RADIUS(22) × 6.8 ≈ 十分な初期間隔。
   */
  useEffect(() => {
    simNodes.current = filteredNodes.map((n, i) => ({
      ...n,
      x: n.x ?? width / 2 + Math.cos((i / filteredNodes.length) * Math.PI * 2) * 150,
      y: n.y ?? height / 2 + Math.sin((i / filteredNodes.length) * Math.PI * 2) * 150,
      vx: 0,
      vy: 0,
      fx: null,
      fy: null,
    }));
  }, [filteredNodes, width, height]);

  /**
   * キャンバス座標（スクリーン座標）からワールド座標（シミュレーション座標）に変換する。
   *
   * 変換式: world = (screen - translate) / scale
   * パン・ズームで Canvas の変換行列が変わっても、ノードのヒットテストに
   * 正しいワールド座標を使えるようにするために必要。
   */
  const getNodeAt = useCallback((cx: number, cy: number) => {
    const { x: tx, y: ty, scale } = transform.current;
    const wx = (cx - tx) / scale;
    const wy = (cy - ty) / scale;
    return simNodes.current.find((n) => {
      const dx = (n.x ?? 0) - wx;
      const dy = (n.y ?? 0) - wy;
      // ユークリッド距離 < ノード半径 + 4px（クリック判定に少し余裕を持たせる）
      return Math.sqrt(dx * dx + dy * dy) < NODE_RADIUS + 4;
    }) ?? null;
  }, []);

  /**
   * 力学シミュレーションの 1 ステップ（tick）を実行する。
   * requestAnimationFrame から毎フレーム呼ばれる。
   *
   * [1] バネ力（リンク）:
   *   力の大きさ = (現在距離 - 目標距離) × バネ定数 / 現在距離
   *   方向: ターゲット方向（dx/dist, dy/dist）に沿って押し引き
   *   バネ定数 0.05: 強すぎると振動、弱すぎると収束が遅い経験的な値
   *
   * [2] 反発力（Coulomb の法則に類似）:
   *   力の大きさ = REPULSION / distance²
   *   方向: ノード間を結ぶ線の方向（dx/dist, dy/dist）
   *   dist² を分母にすることで近いほど強く反発する（電荷の法則と同じ）
   *   計算量は O(N²) だが、知識ベースの規模（〜数千記事）では問題ない
   *
   * [3] 速度減衰（Damping）:
   *   vx *= 0.85 → 毎フレーム速度が 85% になる（15% 減衰）
   *   これがないとノードが永遠に振動し続ける。
   *   0.85 は「ある程度早く止まる」と「シミュレーションが死なない」のバランス。
   *
   * [4] 中心引力:
   *   係数 0.005 は非常に弱い引力。ノードが画面外に飛び出すのを防ぐ程度。
   *
   * fx/fy が null でないノード（ドラッグ中）は力の計算から除外する。
   * 理由: ドラッグ中は直接座標を書き込むため、力による変位が邪魔になる。
   */
  const tick = useCallback(() => {
    const ns = simNodes.current;
    const nodeById = new Map(ns.map((n) => [n.id, n]));

    // [1] バネ力
    for (const edge of filteredEdges) {
      const src = nodeById.get(edge.sourceId);
      const tgt = nodeById.get(edge.targetId);
      if (!src || !tgt) continue;
      const dx = (tgt.x ?? 0) - (src.x ?? 0);
      const dy = (tgt.y ?? 0) - (src.y ?? 0);
      const dist = Math.sqrt(dx * dx + dy * dy) || 1; // 0 除算防止
      // (dist - 目標距離) × バネ定数 / dist で単位ベクトル方向の力成分を得る
      const force = ((dist - LINK_DISTANCE) * 0.05) / dist;
      const fx = dx * force;
      const fy = dy * force;
      // ドラッグ固定中（fx/fy が非 null）は速度を変えない
      if (!src.fx) { src.vx = (src.vx ?? 0) + fx; src.vy = (src.vy ?? 0) + fy; }
      if (!tgt.fx) { tgt.vx = (tgt.vx ?? 0) - fx; tgt.vy = (tgt.vy ?? 0) - fy; }
    }

    // [2] 反発力（全ペア: i < j で重複カウント防止）
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        const a = ns[i], b = ns[j];
        const dx = (b.x ?? 0) - (a.x ?? 0);
        const dy = (b.y ?? 0) - (a.y ?? 0);
        const dist2 = dx * dx + dy * dy || 1; // 距離の二乗（√ を取らずに済む）
        const dist = Math.sqrt(dist2);
        const force = REPULSION / dist2; // Coulomb 則: F ∝ 1/r²
        const fx = (dx / dist) * force; // 単位ベクトル × 力の大きさ
        const fy = (dy / dist) * force;
        if (!a.fx) { a.vx = (a.vx ?? 0) - fx; a.vy = (a.vy ?? 0) - fy; }
        if (!b.fx) { b.vx = (b.vx ?? 0) + fx; b.vy = (b.vy ?? 0) + fy; }
      }
    }

    // [3] 速度減衰 + [4] 中心引力 + 座標更新
    const cx = width / 2, cy = height / 2;
    for (const n of ns) {
      if (!n.fx) {
        // 中心方向への微弱な引力（係数 0.005 = ほぼ感じないレベル）
        n.vx = (n.vx ?? 0) + ((cx - (n.x ?? 0)) * 0.005);
        n.vy = (n.vy ?? 0) + ((cy - (n.y ?? 0)) * 0.005);
        // 速度減衰（Verlet 積分の damping）
        n.vx! *= 0.85;
        n.vy! *= 0.85;
        // 座標を速度で更新（オイラー法: x_new = x + vx）
        n.x = (n.x ?? cx) + n.vx!;
        n.y = (n.y ?? cy) + n.vy!;
      }
    }
  }, [filteredEdges, width, height]);

  /**
   * Canvas に現在のシミュレーション状態を描画する。
   *
   * 描画順序: エッジ → ノード（ノードがエッジより上に重なるため）
   *
   * ctx.save() / ctx.restore() でビュー変換（translate + scale）をスタック管理し、
   * 描画後に変換をリセットする（次フレームに変換が累積しないよう）。
   */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height); // 前フレームをクリア
    ctx.translate(transform.current.x, transform.current.y); // パン
    ctx.scale(transform.current.scale, transform.current.scale); // ズーム

    const nodeById = new Map(simNodes.current.map((n) => [n.id, n]));

    // ---- エッジの描画 ----
    for (const edge of filteredEdges) {
      const src = nodeById.get(edge.sourceId);
      const tgt = nodeById.get(edge.targetId);
      if (!src || !tgt) continue;

      const sx = src.x ?? 0, sy = src.y ?? 0;
      const tx = tgt.x ?? 0, ty = tgt.y ?? 0;

      // ターゲットノードの中心方向の角度を求め、ノード円の縁で線を止める
      const angle = Math.atan2(ty - sy, tx - sx);
      // NODE_RADIUS + 6: ノード円の縁から矢印の先端まで 6px の余白
      const ex = tx - Math.cos(angle) * (NODE_RADIUS + 6);
      const ey = ty - Math.sin(angle) * (NODE_RADIUS + 6);

      // エッジ本体（半透明で描画してノードの見やすさを確保）
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = LINK_TYPE_COLORS[edge.linkType];
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.6; // 60% 透明度
      ctx.stroke();
      ctx.globalAlpha = 1; // 矢印は不透明に戻す

      // 矢印の先端（等辺三角形）
      // angle ± 0.4 rad（≒ 23°）で矢印の広がり角度を定義。
      // 10px: 矢印の長さ。NODE_RADIUS に対して小さすぎず大きすぎない値。
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(
        ex - 10 * Math.cos(angle - 0.4),
        ey - 10 * Math.sin(angle - 0.4)
      );
      ctx.lineTo(
        ex - 10 * Math.cos(angle + 0.4),
        ey - 10 * Math.sin(angle + 0.4)
      );
      ctx.closePath();
      ctx.fillStyle = LINK_TYPE_COLORS[edge.linkType];
      ctx.fill();
    }

    // ---- ノードの描画 ----
    for (const n of simNodes.current) {
      const nx = n.x ?? 0, ny = n.y ?? 0;

      // ノード本体（塗りつぶし円）
      ctx.beginPath();
      ctx.arc(nx, ny, NODE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = isDark ? "#1e3a8a" : "#dbeafe"; // dark: blue-900 / light: blue-100
      ctx.fill();
      ctx.strokeStyle = isDark ? "#3b82f6" : "#2563eb"; // dark: blue-500 / light: blue-600
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // ラベル（ノード下部）
      ctx.fillStyle = isDark ? "#e2e8f0" : "#1e293b"; // dark: slate-200 / light: slate-800
      ctx.font = "11px sans-serif"; // 11px: ズームアウト時に潰れず読める最小サイズ
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // タイトルが 10 文字超えたら省略（Canvas の折り返しは手動実装が必要なため）
      const label =
        n.title.length > 10 ? n.title.slice(0, 10) + "…" : n.title;
      // NODE_RADIUS + 12: ノード円の下縁から 12px 下にラベルを配置
      ctx.fillText(label, nx, ny + NODE_RADIUS + 12);
    }

    ctx.restore();
  }, [filteredEdges, isDark]);

  /**
   * アニメーションループ。requestAnimationFrame で毎フレーム tick → draw を実行。
   *
   * なぜ setInterval ではなく requestAnimationFrame か:
   *   - ブラウザの描画サイクル（60fps）に同期するため、滑らかなアニメーションになる
   *   - タブが非アクティブな間は自動的に停止するのでバッテリー消費を抑えられる
   *   - useEffect のクリーンアップで cancelAnimationFrame し、
   *     コンポーネントアンマウント時にループを止める
   *
   * width/height が 0 の間はループを開始しない（Canvas が未初期化）。
   */
  useEffect(() => {
    if (width === 0 || height === 0) return;
    let frame: number;
    const loop = () => {
      tick();
      draw();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [tick, draw, width, height]);

  // Canvas の物理ピクセルサイズをコンテナに合わせる。
  // CSS の width/height と canvas.width/height は別物。
  // canvas.width を設定しないと Canvas の座標系がデフォルト 300×150 になる。
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && width > 0 && height > 0) {
      canvas.width = width;
      canvas.height = height;
    }
  }, [width, height]);

  /**
   * スクリーン座標 → ワールド座標の変換ヘルパー。
   * ズーム・パン後の Canvas で正確なヒットテストに使う。
   */
  function toWorld(cx: number, cy: number) {
    const { x, y, scale } = transform.current;
    return { wx: (cx - x) / scale, wy: (cy - y) / scale };
  }

  /** ドラッグ開始: ノードを固定座標（fx/fy）にピン止めする */
  function onMouseDown(e: React.MouseEvent) {
    hasMoved.current = false; // mousedown のたびにリセット
    const node = getNodeAt(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    if (node) {
      const { wx, wy } = toWorld(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
      node.fx = wx;
      node.fy = wy;
      // ドラッグ開始時のカーソルとノード中心のオフセットを記憶する。
      // これがないとドラッグ開始時にノードがカーソル位置にジャンプしてしまう。
      dragging.current = {
        node,
        offsetX: wx - (node.x ?? 0),
        offsetY: wy - (node.y ?? 0),
      };
    }
  }

  function onMouseMove(e: React.MouseEvent) {
    const node = getNodeAt(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    if (dragging.current) {
      hasMoved.current = true; // 実際に動いた = ドラッグ確定
      const { wx, wy } = toWorld(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
      // オフセット分を引いてノード中心をカーソルに追従させる
      dragging.current.node.fx = wx - dragging.current.offsetX;
      dragging.current.node.fy = wy - dragging.current.offsetY;
      dragging.current.node.x = wx - dragging.current.offsetX;
      dragging.current.node.y = wy - dragging.current.offsetY;
      setTooltip(null); // ドラッグ中はツールチップを非表示
    } else if (node) {
      // ホバー中のノードにツールチップを表示
      // +12, -8: カーソルの右上にツールチップが重ならないようオフセット
      setTooltip({
        x: e.nativeEvent.offsetX + 12,
        y: e.nativeEvent.offsetY - 8,
        title: node.title,
      });
    } else {
      setTooltip(null);
    }
  }

  function onMouseUp(e: React.MouseEvent) {
    if (dragging.current) {
      const node = dragging.current.node;
      // ピン止めを解除して物理シミュレーションに戻す
      node.fx = null;
      node.fy = null;
      dragging.current = null;
      // hasMoved が false = マウスが動いていない = クリックと判定してページ遷移
      if (!hasMoved.current) {
        router.push(`/entries/${node.id}`);
      }
    }
  }

  /**
   * マウスホイールでズームする。
   *
   * ズームの数学:
   *   カーソル位置 (ox, oy) を中心にズームするには、
   *   単純に scale を変えるだけでなく translate も調整する必要がある。
   *
   *   新しい translate = カーソル位置 - (カーソルのワールド座標 × 新スケール)
   *   x_new = ox - ((ox - x_old) / scale_old) × scale_new
   *
   * スケールの範囲 [0.2, 4]:
   *   - 0.2 以下: ノードが見えなくなる
   *   - 4 以上: 詳細な編集は記事詳細ページで行うため不要
   *
   * e.deltaY * 0.001: ホイール 1 ノッチでスケールを 0.1% 変化させる係数。
   * 小さすぎると操作感が悪く、大きすぎると一気に変化する。
   */
  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const scale = Math.max(0.2, Math.min(4, transform.current.scale * (1 - e.deltaY * 0.001)));
    const ox = e.nativeEvent.offsetX;
    const oy = e.nativeEvent.offsetY;
    // カーソル位置を不動点としてズームする変換式
    transform.current = {
      x: ox - ((ox - transform.current.x) / transform.current.scale) * scale,
      y: oy - ((oy - transform.current.y) / transform.current.scale) * scale,
      scale,
    };
  }

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => setTooltip(null)}
        onWheel={onWheel}
      />

      {/* リンク種別の凡例 */}
      <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-slate-900/80 backdrop-blur rounded-lg p-3 space-y-1.5 border border-slate-200 dark:border-transparent">
        {(Object.entries(LINK_TYPE_LABELS) as [LinkType, string][]).map(([type, label]) => (
          <div key={type} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span
              className="w-4 h-0.5 inline-block"
              style={{ backgroundColor: LINK_TYPE_COLORS[type] }}
            />
            {label}
          </div>
        ))}
        <p className="text-xs text-slate-400 dark:text-slate-600 mt-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          スクロール: ズーム / ドラッグ: 移動
        </p>
      </div>

      {/* ホバー時ツールチップ（ノード名の全表示）*/}
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-transparent text-xs px-2 py-1 rounded shadow-lg z-10"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.title}
        </div>
      )}

      {rawNodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-slate-400 dark:text-slate-600 text-sm">
            記事を作成するとグラフに表示されます
          </p>
        </div>
      )}

      {/* タグフィルタ ドロップダウン */}
      {allTags.length > 0 && (
        <div className="absolute top-4 left-4 z-10">
          {/* トグルボタン */}
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 bg-white/90 dark:bg-slate-900/80 backdrop-blur border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm text-sm text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-900 transition-colors"
          >
            <Tag size={13} className="text-slate-400 dark:text-slate-500" />
            タグフィルタ
            {selectedTags.length > 0 && (
              <span className="bg-blue-600 text-white text-xs font-medium px-1.5 py-0.5 rounded-full leading-none">
                {selectedTags.length}
              </span>
            )}
            <ChevronDown
              size={13}
              className={`text-slate-400 dark:text-slate-500 transition-transform ${filterOpen ? "rotate-180" : ""}`}
            />
          </button>

          {/* ドロップダウンパネル */}
          {filterOpen && (
            <div className="mt-1.5 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden">
              {/* 検索 */}
              <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                <input
                  type="text"
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  placeholder="タグを検索..."
                  className="w-full text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-md px-2 py-1.5 focus:outline-none"
                  autoFocus
                />
              </div>

              {/* タグ一覧（スクロール可能） */}
              <ul className="max-h-52 overflow-y-auto py-1">
                {visibleTags.length === 0 && (
                  <li className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500">
                    一致するタグがありません
                  </li>
                )}
                {visibleTags.map((tag) => {
                  const active = selectedTags.includes(tag);
                  return (
                    <li key={tag}>
                      <button
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs transition-colors ${
                          active
                            ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                            : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        <span>{tag}</span>
                        {active && <Check size={11} className="text-blue-600 dark:text-blue-400 shrink-0" />}
                      </button>
                    </li>
                  );
                })}
              </ul>

              {/* フッター: クリアボタン */}
              {selectedTags.length > 0 && (
                <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => { setSelectedTags([]); setTagSearch(""); }}
                    className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                  >
                    <X size={11} /> 選択をクリア（{selectedTags.length}件）
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
