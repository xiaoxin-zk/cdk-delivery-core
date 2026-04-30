import { ok, route } from "@/lib/api";
import { getPublicSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export function GET() {
  return route(async () => ok(await getPublicSettings()));
}
