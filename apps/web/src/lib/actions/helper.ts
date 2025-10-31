import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Route } from "next";
import { auth } from "@wagents/auth";
import { organization } from "@/lib/auth-client";
import { ActionErrorCode, type ActionState } from "./type";

type RedirectDestination = "/auth/sign-in" | "/onboarding" | "/dashboard";

// Better Auth returns { session, user } not just session
export type SessionData = Awaited<ReturnType<typeof auth.api.getSession>>;

interface AuthCheckResult {
    session: SessionData;
    shouldRedirect: boolean;
    redirectTo: RedirectDestination | null;
    hasOrganization: boolean;
    onboardingCompleted: boolean;
}

export function createErrorState(
    error: string,
    code?: string,
    details?: unknown
): ActionState<never> {
    return {
        status: "error",
        error,
        details: details || { code },
        timestamp: Date.now(),
    };
}

export function createSuccessState<T>(
    data: T,
    message?: string
): ActionState<T> {
    return {
        status: "success",
        data,
        message,
        timestamp: Date.now(),
    };
}

export async function checkAuthAndOrg(): Promise<AuthCheckResult> {
  try {
    const sessionData = await auth.api.getSession({
      headers: await headers(),
    });

    // No session - needs to sign in
    if (!sessionData) {
      return {
        session: null,
        shouldRedirect: true,
        redirectTo: "/auth/sign-in",
        hasOrganization: false,
        onboardingCompleted: false,
      };
    }

    // Get user's organizations
    const organizations = await auth.api.listOrganizations({
      headers: await headers(),
    });

    // No organizations - needs onboarding
    if (!organizations || organizations.length === 0) {
      return {
        session: sessionData,
        shouldRedirect: true,
        redirectTo: "/onboarding",
        hasOrganization: false,
        onboardingCompleted: false,
      };
    }

    // Get active organization or use first one
    let activeOrg;
    if (sessionData.session.activeOrganizationId) {
      activeOrg = await auth.api.getFullOrganization({
        headers: await headers(),
        query: {
          organizationId: sessionData.session.activeOrganizationId,
        },
      });
    } else {
      // No active org set, use the first one
      activeOrg = organizations[0];
      // Set it as active
      await auth.api.setActiveOrganization({
        headers: await headers(),
        body: {
          organizationId: organizations[0].id,
        },
      });
    }

    // Check onboarding status
    if (!activeOrg?.onboardingCompleted) {
      return {
        session: sessionData,
        shouldRedirect: true,
        redirectTo: "/onboarding",
        hasOrganization: true,
        onboardingCompleted: false,
      };
    }

    // All checks passed - user can access dashboard
    return {
      session: sessionData,
      shouldRedirect: false,
      redirectTo: null,
      hasOrganization: true,
      onboardingCompleted: true,
    };
  } catch (error) {
    console.error("Error checking auth and organization:", error);
    // On error, redirect to onboarding to be safe
    return {
      session: null,
      shouldRedirect: true,
      redirectTo: "/onboarding",
      hasOrganization: false,
      onboardingCompleted: false,
    };
  }
}

export async function getSession(){
  const authResult = await auth.api.getSession({
    headers: await headers(),
  });

  if (!authResult) {
    throw createErrorState(
      "Missing session",
      ActionErrorCode.UNAUTHORIZED
    );
  }
  return authResult;
}