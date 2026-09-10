import { NextRequest } from "next/server";

export function getBaseUrl(req?: NextRequest): string {
  if (process.env.NEXT_PUBLIC_BASE_URL && !process.env.NEXT_PUBLIC_BASE_URL.includes("localhost:3000") || !req) {
    if (process.env.NEXT_PUBLIC_BASE_URL) {
      return process.env.NEXT_PUBLIC_BASE_URL;
    }
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  if (req) {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") || "http";
    if (host) {
      return `${proto}://${host}`;
    }
  }

  return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
}
