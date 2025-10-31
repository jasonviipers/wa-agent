import {
  AccountSettingsCards,
  ApiKeysCard,
  DeleteAccountCard,
  PasskeysCard,
  ProvidersCard,
  SessionsCard,
} from "@daveyplate/better-auth-ui";
import {
  AlertTriangleIcon,
  KeyIcon,
  PaletteIcon,
  Shield,
  UsersIcon,
} from "lucide-react";
// import { ThemePreferencesCard } from "@/components/settings/theme-preferences";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/global/page-header";

export const metadata = {
    title: "Settings",
    description: "Manage your account settings and preferences.",
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        description="Manage your account settings and preferences."
        title="Settings"
      />
      <Tabs
        className="mx-auto flex max-w-6xl flex-col gap-6 lg:flex-row lg:gap-8"
        defaultValue="account"
      >
        {/* Mobile Tabs - Horizontal */}
        <TabsList className="flex h-auto w-full items-center justify-start gap-2 bg-transparent p-0 lg:hidden">
          <TabsTrigger
            className="shrink-0 gap-2 rounded-lg border border-transparent bg-secondary px-4 py-2 font-normal text-muted-foreground text-sm data-[state=active]:border-border data-[state=active]:bg-secondary data-[state=active]:text-foreground"
            value="account"
          >
            <UsersIcon className="h-4 w-4" />
            Account
          </TabsTrigger>
          <TabsTrigger
            className="shrink-0 gap-2 rounded-lg border border-transparent bg-secondary px-4 py-2 font-normal text-muted-foreground text-sm data-[state=active]:border-border data-[state=active]:bg-secondary data-[state=active]:text-foreground"
            value="security"
          >
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger
            className="shrink-0 gap-2 rounded-lg border border-transparent bg-secondary px-4 py-2 font-normal text-muted-foreground text-sm data-[state=active]:border-border data-[state=active]:bg-secondary data-[state=active]:text-foreground"
            value="appearance"
          >
            <PaletteIcon className="h-4 w-4" />
            Apparance
          </TabsTrigger>
          <TabsTrigger
            className="shrink-0 gap-2 rounded-lg border border-transparent bg-secondary px-4 py-2 font-normal text-muted-foreground text-sm data-[state=active]:border-border data-[state=active]:bg-secondary data-[state=active]:text-foreground"
            value="api"
          >
            <KeyIcon className="h-4 w-4" />
            Api
          </TabsTrigger>
          <TabsTrigger
            className="shrink-0 gap-2 rounded-lg border border-transparent bg-secondary px-4 py-2 font-normal text-muted-foreground text-sm data-[state=active]:border-border data-[state=active]:bg-secondary data-[state=active]:text-foreground"
            value="danger"
          >
            <AlertTriangleIcon className="h-4 w-4" />
            Danger Zone
          </TabsTrigger>
        </TabsList>
        {/* Desktop Tabs - Vertical Sidebar */}
        <div className="hidden lg:block lg:w-56">
          <TabsList className="flex h-auto w-full flex-col items-stretch gap-2 bg-transparent p-0">
            <TabsTrigger
              className="justify-start gap-2 rounded-lg border border-transparent bg-transparent px-3 py-2 font-normal text-muted-foreground text-sm hover:bg-accent hover:text-foreground data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              value="account"
            >
              <UsersIcon className="h-4 w-4" />
              Account
            </TabsTrigger>
            <TabsTrigger
              className="justify-start gap-2 rounded-lg border border-transparent bg-transparent px-3 py-2 font-normal text-muted-foreground text-sm hover:bg-accent hover:text-foreground data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              value="security"
            >
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
            <TabsTrigger
              className="justify-start gap-2 rounded-lg border border-transparent bg-transparent px-3 py-2 font-normal text-muted-foreground text-sm hover:bg-accent hover:text-foreground data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              value="appearance"
            >
              <PaletteIcon className="h-4 w-4" />
              Appearance
            </TabsTrigger>
            <TabsTrigger
              className="justify-start gap-2 rounded-lg border border-transparent bg-transparent px-3 py-2 font-normal text-muted-foreground text-sm hover:bg-accent hover:text-foreground data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              value="api"
            >
              <KeyIcon className="h-4 w-4" />
              Api
            </TabsTrigger>
            <TabsTrigger
              className="justify-start gap-2 rounded-lg border border-transparent bg-transparent px-3 py-2 font-normal text-muted-foreground text-sm hover:bg-accent hover:text-foreground data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              value="danger"
            >
              <AlertTriangleIcon className="h-4 w-4" />
              Danger Zone
            </TabsTrigger>
          </TabsList>
        </div>
        <div className="min-w-0 flex-1 lg:max-w-3xl">
          <TabsContent className="mt-0" id="account" value="account">
            <div className="space-y-6">
              <AccountSettingsCards />
            </div>
          </TabsContent>

          <TabsContent className="mt-0" id="security" value="security">
            <div className="space-y-6">
              <ProvidersCard />
              <PasskeysCard />
              <SessionsCard />
            </div>
          </TabsContent>

          <TabsContent className="mt-0" id="appearance" value="appearance">
            <div className="space-y-6">
              {/* <ThemePreferencesCard /> */}
            </div>
          </TabsContent>
          <TabsContent className="mt-0" id="api" value="api">
            <div className="space-y-6">
              <ApiKeysCard />
            </div>
          </TabsContent>

          <TabsContent className="mt-0" value="danger">
            <div className="space-y-6">
              <DeleteAccountCard />
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
