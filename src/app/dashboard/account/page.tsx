import { ChangePasswordForm } from "@/components/change-password-form";

export default function MemberAccountPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update your login password.
        </p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
