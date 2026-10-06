import { Suspense } from "react";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export default function ResetPasswordPage() {
  // useSearchParams needs a Suspense boundary for static prerendering.
  return (
    <div className="mx-auto max-w-sm pt-10">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
