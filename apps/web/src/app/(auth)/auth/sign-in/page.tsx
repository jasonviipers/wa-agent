import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { AuthForm } from "@/components/auth/auth-form";
import { Button } from "@/components/ui/button";
import { requireNoAuth } from "@/actions/server-auth-redirect";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your account",
};

export default async function AuthPage() {
  await requireNoAuth();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <Link className="absolute top-6 left-8" href="/">
        <Button
          className="hover:bg-secondary hover:text-secondary-foreground hover:ring-2 hover:ring-secondary/50"
          size="sm"
          variant="outline"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </Link>
      <div className="w-full max-w-sm">
        <AuthForm />
      </div>
    </div>
  );
}
