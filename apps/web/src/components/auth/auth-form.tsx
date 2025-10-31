"use client";
import { AlertCircle, Key, Loader2 } from "lucide-react";
import { useQueryState } from "nuqs";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { GitHub, Google, WaLogo } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebounce } from "@/hooks/use-debounce";
import { getLastUsedLoginMethod, signIn, organization } from "@/lib/auth-client";
import {
  AUTH_BUTTON_TEXT,
  AUTH_ERROR_MESSAGES,
  type AuthMethod,
  type LastUsedMethod,
  LOADING_MESSAGES,
  type SocialProvider,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Route } from "next";

const emailSchema = z.email();

type AuthError = {
  message: string;
  code?: string;
};


interface LoginFormProps extends React.ComponentProps<"div"> {
  callbackURL?: Route;
}

export function AuthForm({
  className,
  callbackURL = `/workspace`,
  ...props
}: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useQueryState("email", {
    defaultValue: "",
    clearOnDefault: true,
  });

  const [emailError, setEmailError] = useState("");
  const [authError, setAuthError] = useState<AuthError | null>(null);
  const [isPending, startTransition] = useTransition();
  const [currentMethod, setCurrentMethod] = useState<AuthMethod | null>(null);
  const [lastMethod, setLastMethod] = useState<LastUsedMethod | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const lastUsedMethod = getLastUsedLoginMethod();
    setLastMethod(lastUsedMethod as LastUsedMethod);
  }, []);

  const checkOrganizationAndRedirect = useCallback(async () => {
    try {
      const { data: organizations } = await organization.list();

      if (organizations && organizations.length > 0) {
        router.push(callbackURL);
      } else {
        router.push("/onboarding");
      }
    } catch (error) {
      console.error("Error checking organization:", error);
      router.push(callbackURL);
    }
  }, [router, callbackURL]);

  // Handle authentication errors with better type safety
  const handleAuthError = useCallback((error: unknown) => {
    let errorMessage = "An error occurred during sign in. Please try again.";
    let errorCode: string | undefined;

    if (error && typeof error === "object") {
      if ("code" in error && typeof error.code === "string") {
        errorCode = error.code;
        errorMessage =
          AUTH_ERROR_MESSAGES[error.code as keyof typeof AUTH_ERROR_MESSAGES] ||
          errorMessage;
      } else if ("message" in error && typeof error.message === "string") {
        errorMessage = error.message;
      }
    }

    setAuthError({ message: errorMessage, code: errorCode });
  }, []);

  // Validate email with Zod schema
  const validateEmail = useCallback((emailValue: string): boolean => {
    if (!emailValue.trim()) {
      setEmailError("");
      return false;
    }

    try {
      emailSchema.parse(emailValue);
      setEmailError("");
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        setEmailError(error.issues[0]?.message || "Invalid email");
      } else {
        setEmailError("Please enter a valid email address");
      }
      return false;
    }
  }, []);

  const debouncedValidation = useDebounce((email: string) => {
    if (email.trim()) {
      validateEmail(email);
    }
  }, 300);

 
  const handleEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setEmail(value);

      if (emailError) setEmailError("");
      if (authError) setAuthError(null);

      debouncedValidation(value);
    },
    [emailError, authError, debouncedValidation, setEmail],
  );

  const handleMagicLinkSignIn = useCallback(async () => {
    const trimmedEmail = email.trim();

    if (!validateEmail(trimmedEmail)) {
      emailInputRef.current?.focus();
      return;
    }

    setAuthError(null);
    setCurrentMethod("magicLink");

    startTransition(async () => {
      try {
        const result = await signIn.magicLink(
          { email: trimmedEmail },
          {
            onRequest: () => { },
            onResponse: () => { },
            onSuccess: async () => {
              toast.success("Sign in link sent to your email");
              await checkOrganizationAndRedirect();
            },
            onError: handleAuthError,
          },
        );

        if (result?.data?.status) {
          setAuthError(null);
        }
      } catch (error) {
        handleAuthError(error);
      } finally {
        setCurrentMethod(null);
      }
    });
  }, [email, validateEmail, handleAuthError, checkOrganizationAndRedirect]);

  const handlePasskeySignIn = useCallback(async () => {
    setAuthError(null);
    setCurrentMethod("passkey");

    startTransition(async () => {
      try {
        await signIn.passkey();
        await checkOrganizationAndRedirect();
      } catch (error) {
        handleAuthError(error);
      } finally {
        setCurrentMethod(null);
      }
    });
  }, [handleAuthError, checkOrganizationAndRedirect]);


  const handleSocialSignIn = useCallback(
    async (provider: SocialProvider) => {
      setAuthError(null);
      setCurrentMethod(provider);

      startTransition(async () => {
        try {
          await signIn.social({
            provider,
            callbackURL: "/callback",
          });
        } catch (error) {
          handleAuthError(error);
        } finally {
          setCurrentMethod(null);
        }
      });
    },
    [handleAuthError],
  );

  const handleFormSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      handleMagicLinkSignIn();
    },
    [handleMagicLinkSignIn],
  );

  const isLoading = useCallback(
    (method: AuthMethod) => isPending && currentMethod === method,
    [isPending, currentMethod],
  );

  const renderLastUsedBadge = useCallback(
    (method: LastUsedMethod) => {
      if (lastMethod === method) {
        return (
          <Badge
            className="absolute -right-1 -top-3 text-xs"
            variant="lastUsed"
          >
            Last used
          </Badge>
        );
      }
      return null;
    },
    [lastMethod],
  );

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form noValidate onSubmit={handleFormSubmit} ref={formRef}>
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex flex-col items-center gap-2 font-medium">
              <WaLogo className="h-16 w-16" />
            </div>
          </div>

          {/* Error Display */}
          {authError && (
            <Alert role="alert" variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{authError.message}</AlertDescription>
            </Alert>
          )}

          {/* Email Form */}
          <div className="flex flex-col gap-6">
            <div className="grid gap-3">
              <Label htmlFor="email">Email</Label>
              <Input
                aria-describedby={
                  emailError ? "email-error email-hint" : "email-hint"
                }
                aria-invalid={!!emailError}
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect="off"
                className={
                  emailError ? "border-red-500 focus:border-red-500" : ""
                }
                disabled={isPending}
                id="email"
                inputMode="email"
                onChange={handleEmailChange}
                placeholder="m@example.com"
                ref={emailInputRef}
                required
                spellCheck={false}
                type="email"
                value={email}
              />
              {emailError && (
                <p
                  className="text-sm text-red-500"
                  id="email-error"
                  role="alert"
                >
                  {emailError}
                </p>
              )}
            </div>

            {/* Magic Link Button */}
            <Button
              aria-describedby="magic-link-description"
              className="relative w-full bg-primary text-white hover:bg-primary/90"
              disabled={isPending}
              type="submit"
            >
              {isLoading("magicLink") ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {LOADING_MESSAGES.magicLink}
                </>
              ) : (
                <>
                  {AUTH_BUTTON_TEXT.magicLink}
                  {renderLastUsedBadge("email")}
                </>
              )}
            </Button>
            <span className="sr-only" id="magic-link-description">
              Sign in with a secure link sent to your email
            </span>

            {/* Passkey Button */}
            <Button
              aria-describedby="passkey-description"
              className="relative w-full"
              disabled={isPending}
              onClick={handlePasskeySignIn}
              type="button"
              variant="outline"
            >
              {isLoading("passkey") ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {LOADING_MESSAGES.passkey}
                </>
              ) : (
                <>
                  <Key className="mr-2 size-4" />
                  {AUTH_BUTTON_TEXT.passkey}
                  {renderLastUsedBadge("passkey")}
                </>
              )}
            </Button>
            <span className="sr-only" id="passkey-description">
              Sign in using biometric authentication or security key
            </span>
          </div>

          {/* Divider */}
          <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
            <span className="relative z-10 bg-background px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>

          {/* Social Buttons */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Button
              aria-describedby="github-description"
              className="relative w-full"
              disabled={isPending}
              onClick={() => handleSocialSignIn("github")}
              type="button"
              variant="outline"
            >
              {isLoading("github") ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {LOADING_MESSAGES.github}
                </>
              ) : (
                <>
                  <GitHub className="mr-2 size-5" />
                  {AUTH_BUTTON_TEXT.github}
                  {renderLastUsedBadge("github")}
                </>
              )}
            </Button>
            <span className="sr-only" id="github-description">
              Sign in with your GitHub account
            </span>

            <Button
              aria-describedby="google-description"
              className="relative w-full"
              disabled={isPending}
              onClick={() => handleSocialSignIn("google")}
              type="button"
              variant="outline"
            >
              {isLoading("google") ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {LOADING_MESSAGES.google}
                </>
              ) : (
                <>
                  <Google className="mr-2 size-5" />
                  {AUTH_BUTTON_TEXT.google}
                  {renderLastUsedBadge("google")}
                </>
              )}
            </Button>
            <span className="sr-only" id="google-description">
              Sign in with your Google account
            </span>
          </div>
        </div>
      </form>

      {/* Terms */}
      <div className="text-balance text-center text-xs text-muted-foreground">
        By continuing, you agree to our{" "}
        <a
          className="underline underline-offset-4 hover:text-primary"
          href="/terms"
        >
          Terms of Service
        </a>{" "}
        and{" "}
        <a
          className="underline underline-offset-4 hover:text-primary"
          href="/privacy"
        >
          Privacy Policy
        </a>
        .
      </div>
    </div>
  );
}