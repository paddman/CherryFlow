import { AuthGate } from "../../../components/AuthGate";
import { WorkflowRunner } from "../../../components/WorkflowRunner";
import "../runner.css";

export default async function WorkflowRunPage({ params }: { params: Promise<{ workflowId: string }> }) {
  const { workflowId } = await params;
  return <AuthGate><WorkflowRunner workflowId={workflowId} /></AuthGate>;
}
