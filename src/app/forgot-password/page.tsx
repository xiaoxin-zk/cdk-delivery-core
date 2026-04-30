import { ForgotPasswordForm } from "@/components/auth/AuthForms";
import { getPublicSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  return <ForgotPasswordForm settings={await getPublicSettings()} />;
}
