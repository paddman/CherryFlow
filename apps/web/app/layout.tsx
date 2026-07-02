import type { ReactNode } from "react";
import "./styles.css";

export const metadata = {
  title: "CherryFlow",
  description: "AI-first workflow and app builder",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
