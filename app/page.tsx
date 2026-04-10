import { KnowledgeGraph } from "@/components/KnowledgeGraph";
import { prisma } from "@/lib/prisma";

async function getGraphData() {
  try {
    const [entries, links] = await Promise.all([
      prisma.knowledgeEntry.findMany({
        select: { id: true, title: true, tags: true },
      }),
      prisma.knowledgeLink.findMany({
        select: { id: true, sourceId: true, targetId: true, linkType: true },
      }),
    ]);
    return { nodes: entries, edges: links };
  } catch {
    return { nodes: [], edges: [] };
  }
}

export default async function HomePage() {
  const { nodes, edges } = await getGraphData();

  return (
    <div className="w-full h-full">
      <KnowledgeGraph nodes={nodes} edges={edges} />
    </div>
  );
}
