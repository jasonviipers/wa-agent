import { polarClient } from "@polar-sh/better-auth";
import {
  apiKeyClient,
  inferOrgAdditionalFields,
  lastLoginMethodClient,
  magicLinkClient,
  organizationClient,
  passkeyClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { auth } from "@wagents/auth";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL as string,
  plugins: [
    apiKeyClient(),
    passkeyClient(),
    magicLinkClient(),
    polarClient(),
    organizationClient({
      schema: inferOrgAdditionalFields<typeof auth>(),
    }),
    lastLoginMethodClient(),
  ],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
  getLastUsedLoginMethod,
  organization,
  polar,
  checkout,
} = authClient;
