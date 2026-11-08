import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Versus — AI answers, side by side",
  description: "Compare AI model responses side by side, judge the answers, and find the right model for the job.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
