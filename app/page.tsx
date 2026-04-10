import { KnowledgeGraph } from "@/components/KnowledgeGraph";

async function getGraphData() {
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const res = await fetch(`${base}/api/graph`, { cache: "no-store" });
    if (!res.ok) return { nodes: [], edges: [] };
    return res.json();
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
