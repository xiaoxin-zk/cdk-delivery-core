import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/AuthForms";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
