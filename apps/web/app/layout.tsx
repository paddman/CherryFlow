import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./styles.css";
import "./site-entry.css";

export const metadata: Metadata = {
  title: "CherryFlow — Local Qwen AI Workflow Platform",
  description: "เชื่อม Local Qwen, OpenAI-compatible API, Workflow, Agent, Machine Learning และ Deep Learning Worker ในแพลตฟอร์มเดียว",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="th"><body>{children}</body></html>;
}
