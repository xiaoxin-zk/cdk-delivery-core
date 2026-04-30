import { ok, route } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export function GET() {
  return route(async () => ok({ user: await getCurrentUser() }));
}
