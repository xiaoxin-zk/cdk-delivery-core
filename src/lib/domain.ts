import type { AuthUser } from "@/lib/auth";

export function canEditResource(user: Pick<AuthUser, "id" | "role">, ownerId: string) {
  return user.role === "ADMIN" || user.id === ownerId;
}

export function shouldReviewProject(options: {
  reviewEnabled: boolean;
  sensitiveMode: string;
  matchedWords: string[];
}) {
  if (options.sensitiveMode === "block" && options.matchedWords.length > 0) return "BLOCK";
  if (options.reviewEnabled) return "REVIEW";
  if (options.sensitiveMode === "review" && options.matchedWords.length > 0) return "REVIEW";
  return "APPROVE";
}
