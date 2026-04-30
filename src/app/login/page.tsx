import { LoginForm } from "@/components/auth/AuthForms";
import { getPublicSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  return <LoginForm settings={await getPublicSettings()} />;
}
