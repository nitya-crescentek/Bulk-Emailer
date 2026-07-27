import { handle } from "@/lib/http";
import { destroySession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return handle(async () => {
    await destroySession();
    return { ok: true };
  });
}
