import { handle } from "@/lib/http";
import { getCurrentUser, toPublicUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const user = await getCurrentUser();
    return { user: user ? toPublicUser(user) : null };
  });
}
