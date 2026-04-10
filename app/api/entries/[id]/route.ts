/**
 * GET    /api/entries/[id]  - 記事詳細取得（リンク情報付き）
 * PUT    /api/entries/[id]  - 記事更新
 * DELETE /api/entries/[id]  - 記事削除
 *
 * Next.js 16 の破壊的変更:
 *   params が Promise になった。以前は { params: { id: string } } と
 *   同期的に受け取れたが、v16 からは必ず await が必要。
 *   型エイリアス Ctx でこのパターンを共有する。
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/auth";
import { generateEmbedding, hasEmbeddingSupport } from "@/lib/embeddings";

/** Next.js 16 の Route Handler コンテキスト型。params は非同期で解決する。 */
type Ctx = { params: Promise<{ id: string }> };

/**
 * 記事詳細を取得する。
 *
 * include で outgoingLinks / incomingLinks を一度に取得する理由:
 *   - 詳細ページでリンク情報をサイドパネルに表示するため
 *   - 2 回の SELECT より JOIN の方が DB への往復が少ない
 *
 * embedding を除外して返す理由:
 *   - 1536 次元の float 配列はレスポンスが数 KB 増える
 *   - フロントエンドでは Embedding の生の値は不要（表示・編集に使わない）
 *   - デストラクチャリングで除外: const { embedding: _emb, ...rest } = entry
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;

  const entry = await prisma.knowledgeEntry.findUnique({
    where: { id },
    include: {
      outgoingLinks: {
        include: { target: { select: { id: true, title: true, tags: true } } },
      },
      incomingLinks: {
        include: { source: { select: { id: true, title: true, tags: true } } },
      },
    },
  });

  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // embedding フィールドをレスポンスから除外する（上記参照）
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { embedding: _emb, ...rest } = entry;
  return NextResponse.json(rest);
}

/**
 * 記事を更新する。
 *
 * 編集時の重複チェック戦略:
 *   - タイトル重複: 「自分以外で同じタイトルが存在するか」で判定（NOT: { id }）
 *     自分自身は除外しないとタイトル未変更の保存が 409 になってしまう。
 *   - コンテンツハッシュ: 更新時は「内容が変わった」という前提なので再チェックしない。
 *     完全一致の別記事があっても統合は編集者の判断に任せる。
 *   - 意味的重複: 編集時は既存記事との重複警告を省略し、Embedding の更新のみ行う。
 *     再度重複チェックすると「編集前の自分の記事と似ている」と誤検知するため。
 */
export async function PUT(req: NextRequest, { params }: Ctx) {
  const authError = await requireWriter();
  if (authError) return authError;

  const { id } = await params;
  const body = await req.json();
  const { title, content, tags } = body;

  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json(
      { error: "タイトルと本文は必須です" },
      { status: 400 }
    );
  }

  // 自分以外で同名タイトルの記事が存在するかチェック
  const conflict = await prisma.knowledgeEntry.findFirst({
    where: { title, NOT: { id } }, // Prisma の NOT 演算子で自身を除外
    select: { id: true },
  });
  if (conflict) {
    return NextResponse.json(
      { error: "同じタイトルの記事が既に存在します", existingId: conflict.id },
      { status: 409 }
    );
  }

  // コンテンツが変わった場合に備えてハッシュを再計算する
  const contentHash = crypto
    .createHash("sha256")
    .update(content)
    .digest("hex");

  // 編集後の内容で Embedding を再生成して検索精度を保つ
  let embedding: number[] | undefined;
  if (hasEmbeddingSupport()) {
    try {
      embedding = await generateEmbedding(`${title}\n\n${content}`);
    } catch {
      // 失敗しても更新は続行（古い embedding のままになるが許容範囲）
    }
  }

  const entry = await prisma.knowledgeEntry.update({
    where: { id },
    data: {
      title,
      content,
      contentHash,
      tags: tags ?? [], // tags が undefined の場合は空配列にリセット
      ...(embedding ? { embedding } : {}),
    },
  });

  return NextResponse.json(entry);
}

/**
 * 記事を削除する。
 *
 * Prisma スキーマの onDelete: Cascade により、
 * この記事を source または target とする KnowledgeLink も自動的に削除される。
 * これで「死にリンク」（参照先が存在しないリンク）が発生しない。
 *
 * 204 No Content: 削除成功時はボディを返さないのが REST の慣習。
 */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const authError = await requireWriter();
  if (authError) return authError;

  const { id } = await params;

  await prisma.knowledgeEntry.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
