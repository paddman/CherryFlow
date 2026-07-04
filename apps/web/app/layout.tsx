import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./styles.css";
import "./site-entry.css";

export const metadata: Metadata = {
  title: "CherryFlow — AI Workflow & Website Builder",
  description: "สร้าง Workflow เชื่อม AI และ Publish เป็นเว็บไซต์พร้อมใช้งานจากแพลตฟอร์มเดียว",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="th"><body>{children}</body></html>;
}
