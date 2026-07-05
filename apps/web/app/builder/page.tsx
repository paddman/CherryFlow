import { AppBuilder } from "../../components/AppBuilder";
import { AuthGate } from "../../components/AuthGate";

export default function BuilderPage() {
  return <AuthGate><AppBuilder workflowId="report-generator" /></AuthGate>;
}
