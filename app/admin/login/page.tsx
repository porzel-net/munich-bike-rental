import { BikeIcon } from "lucide-react";
import Link from "next/link";

import { LoginForm } from "@/components/login-form";

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="flex items-center justify-center gap-2 self-center font-medium">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <BikeIcon className="size-4" aria-hidden="true" />
          </div>
          <span>Your Bike Rental</span>
        </Link>
        <LoginForm />
      </div>
    </main>
  );
}
