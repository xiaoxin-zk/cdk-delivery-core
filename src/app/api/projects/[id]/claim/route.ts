import { NextRequest } from "next/server";
import { ok, route } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { claimRandomCdk } from "@/lib/claims";
import { getClientIp, getUserAgent } from "@/lib/request";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSettingsMap } from "@/lib/settings";
import { verifyTurnstile } from "@/lib/turnstile";
import { claimSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export function POST(request: NextRequest, { params }: Params) {
  return route(async () => {
    const user = await getCurrentUser();
    const ip = getClientIp(request);
    const settings = await getSettingsMap(["claim.rateLimit.perMinute"]);
    const limit = Math.max(1, Number(settings.get("claim.rateLimit.perMinute") ?? "10") || 10);
    await enforceRateLimit(`claim:${params.id}:${user?.id ?? ip}`, limit, 60);

    const body = claimSchema.parse(await request.json());
    await verifyTurnstile("claim", body.turnstileToken, ip);
    const result = await claimRandomCdk({
      projectId: params.id,
      user,
      emailOrIdentifier: body.emailOrIdentifier,
      ip,
      userAgent: getUserAgent(request)
    });
    return ok(result);
  });
}
