import { SignupForm } from "@/components/signup-form";

export const dynamic = "force-dynamic";

export default async function InvitationSignupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="flex min-h-svh w-full items-center justify-center bg-muted/30 p-6 md:p-10">
      <div className="w-full max-w-md">
        <SignupForm token={token} />
      </div>
    </main>
  );
}
