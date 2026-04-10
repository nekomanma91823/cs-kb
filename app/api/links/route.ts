/**
 * POST /api/links - ナレッジリンクの作成
 *
 * バリデーションの順序:
 *   1. 必須フィールドの存在チェック（400）
 *   2. 自己参照の禁止（400）
 *   3. 参照先エントリの存在確認（404）
 *   4. 循環参照チェック（422） ← PREREQUISITE のみ
 *   5. DB への保存（重複時は 409）
 *
 * 順序の理由: 安価なチェック（メモリ内）を先に行い、
 * DB アクセスが必要な高コストなチェックを後回しにする。
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/auth";
import { wouldCreateCycle } from "@/lib/graph-utils";
import { LinkType } from "@/app/generated/prisma/enums";

export async function POST(req: NextRequest) {
  const authError = await requireWriter();
  if (authError) return authError;

  const body = await req.json();
  const { sourceId, targetId, linkType } = body as {
    sourceId: string;
    targetId: string;
    linkType: LinkType;
  };

  // ---- バリデーション 1: 必須フィールド ----
  if (!sourceId || !targetId || !linkType) {
    return NextResponse.json({ error: "必須フィールドが不足しています" }, { status: 400 });
  }

  // ---- バリデーション 2: 自己参照の禁止 ----
  // 「A は A の前提条件」のような意味をなさないリンクを防ぐ。
  // DB の CHECK 制約でも防げるが、Prisma スキーマでは表現しにくいため API 層で処理。
  if (sourceId === targetId) {
    return NextResponse.json({ error: "自己参照リンクは作成できません" }, { status: 400 });
  }

  // ---- バリデーション 3: 参照先エントリの存在確認 ----
  // Promise.all で並列実行することで 2 回の DB ラウンドトリップを 1 回に削減する。
  const [src, tgt] = await Promise.all([
    prisma.knowledgeEntry.findUnique({ where: { id: sourceId }, select: { id: true } }),
    prisma.knowledgeEntry.findUnique({ where: { id: targetId }, select: { id: true } }),
  ]);
  if (!src || !tgt) {
    return NextResponse.json({ error: "参照先のエントリが存在しません" }, { status: 404 });
  }

  // ---- バリデーション 4: 循環参照チェック（PREREQUISITE のみ）----
  // DERIVATION / APPLICATION は循環しても論理的に問題ない（例: 理論⇄応用）ため、
  // PREREQUISITE だけに適用する。詳細は lib/graph-utils.ts の wouldCreateCycle を参照。
  if (linkType === "PREREQUISITE") {
    // 全 PREREQUISITE エッジを取得（select で最小限のフィールドのみ）
    const existingPrereqs = await prisma.knowledgeLink.findMany({
      where: { linkType: "PREREQUISITE" },
      select: { sourceId: true, targetId: true },
    });

    if (wouldCreateCycle(existingPrereqs, { sourceId, targetId })) {
      // 422 Unprocessable Entity: リクエストの構文は正しいが、
      // セマンティクス上処理できない場合に使う HTTP ステータス
      return NextResponse.json(
        { error: "循環参照が発生するため、このリンクは作成できません" },
        { status: 422 }
      );
    }
  }

  // ---- DB への保存 ----
  try {
    const link = await prisma.knowledgeLink.create({
      data: { sourceId, targetId, linkType },
      include: {
        // 作成後のレスポンスでリンク先のタイトルも返すことで、
        // フロントエンドが即座に UI を更新できる
        source: { select: { id: true, title: true } },
        target: { select: { id: true, title: true } },
      },
    });
    return NextResponse.json(link, { status: 201 });
  } catch (err: unknown) {
    // スキーマの @@unique([sourceId, targetId, linkType]) による制約違反。
    // 同じ種類のリンクが既に存在する場合に発生する。
    // Prisma 7 のエラーメッセージから "Unique constraint" を検出する。
    if (
      err instanceof Error &&
      err.message.includes("Unique constraint")
    ) {
      return NextResponse.json({ error: "同じリンクが既に存在します" }, { status: 409 });
    }
    // それ以外のエラーは上位に伝播させて 500 として扱う
    throw err;
  }
}
