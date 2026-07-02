"use client";

import { useEffect, useState } from "react";
import type { UiSchema, WorkflowContract } from "@cherryflow/ui-schema";
import { requestJson } from "../lib/client";
import { SchemaRenderer } from "./SchemaRenderer";

export function PublishedApp({ slug }: { slug: string }) {
  const [data, setData] = useState<{ schema: UiSchema; workflow: WorkflowContract } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    requestJson<{ schema: UiSchema; workflow: WorkflowContract }>(`/api/apps/${encodeURIComponent(slug)}`)
      .then(setData)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load app"));
  }, [slug]);

  if (error) return <main className="loadingScreen"><section><h1>ไม่พบแอปที่เผยแพร่</h1><p>{error}</p></section></main>;
  if (!data) return <main className="loadingScreen">กำลังโหลด CherryFlow App...</main>;

  return <SchemaRenderer schema={data.schema} workflow={data.workflow} runPath={`/api/apps/${encodeURIComponent(slug)}/run`} publicMode />;
}
