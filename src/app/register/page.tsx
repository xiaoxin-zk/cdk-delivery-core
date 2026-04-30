import { RegisterForm } from "@/components/auth/AuthForms";
import { getPublicSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  return <RegisterForm settings={await getPublicSettings()} />;
}
