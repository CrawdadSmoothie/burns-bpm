import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Burns BPM",
  description: "Live heart rate monitoring",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ background: "#100f0d", margin: 0 }}>{children}</body>
    </html>
  );
}
