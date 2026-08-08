import { AppBuilder } from "../../components/AppBuilder";
import { AuthGate } from "../../components/AuthGate";

export default async function BuilderPage({ searchParams }: { searchParams: Promise<{ workflow?: string | string[] }> }) {
  const params = await searchParams;
  const selected = Array.isArray(params.workflow) ? params.workflow[0] : params.workflow;
  const workflowId = selected?.trim() || "report-generator";
  return <AuthGate><AppBuilder workflowId={workflowId} /></AuthGate>;
}
