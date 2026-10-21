import { readScript } from "@/lib/script";

// Serves the real script for the "Download" link.
export const dynamic = "force-static";

export function GET() {
  return new Response(readScript(), {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Content-Disposition": 'attachment; filename="ticket-check.js"',
    },
  });
}
