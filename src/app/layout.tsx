import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rate Limit Tester | Load Test & Rate Limit Observability",
  description:
    "A Vercel-hosted tool to load-test endpoints and observe rate-limiting behavior in real time, with server-side batch execution and reliable stop controls.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500 selection:text-white min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
