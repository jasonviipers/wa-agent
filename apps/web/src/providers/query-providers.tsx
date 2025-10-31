"use client";
import { AuthUIProvider } from "@daveyplate/better-auth-ui";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "@/components/ui/sonner";
import { authClient } from "@/lib/auth-client";
import { ThemeProvider } from "./theme-provider";
import { queryClient } from "@/lib/query-client";
import { deleteAvatar, uploadAvatar } from "@/lib/actions/upload";

export default function QueryProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      disableTransitionOnChange
      enableSystem
    >
      <QueryClientProvider client={queryClient}>
        <NuqsAdapter>
          <AuthUIProvider
            apiKey={true}
            authClient={authClient}
            avatar={{
              upload: async (file) => {
                try {
                  const formData = new FormData();
                  formData.append("avatar", file);
                  const result = await uploadAvatar(formData);

                  if (result.error) {
                    throw new Error(result.error);
                  }

                  return result.url;
                } catch (error) {
                  console.error("Avatar upload failed:", error);
                  throw error; // Re-throw so Better Auth UI can handle it
                }
              },
              delete: async (url) => {
                await deleteAvatar(url);
              },
            }}
            Link={Link}
            magicLink={true}
            navigate={router.push}
            passkey={true}
            replace={router.replace}
            settings={{ url: "/settings" }}
            social={{ providers: ["github", "google"] }}
            viewPaths={{
              SIGN_IN: "sign-in",
              SIGN_UP: "sign-in",
            }}
          >
            {children}
          </AuthUIProvider>
        </NuqsAdapter>
        <ReactQueryDevtools />
      </QueryClientProvider>
      <Toaster />
    </ThemeProvider>
  );
}
