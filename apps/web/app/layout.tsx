import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./styles.css";
import "./site-entry.css";

export const metadata: Metadata = {
  title: "CherryFlow AI Website & Workflow Builder",
  description: "Generate, preview, run, version, and publish workflow websites with AI.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="th"><body>{children}</body></html>;
}
