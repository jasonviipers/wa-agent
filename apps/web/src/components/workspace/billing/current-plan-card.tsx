"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CreditCard, TrendingUp, Calendar, ExternalLink, Loader2, Users, Building, MessageSquare, Zap } from "lucide-react";
import { getPlanBySlug, type PlanSlug, getRemainingQuota, canCreateResource } from "./plan";
import { formatDate } from "@/lib/utils";
import { authClient, organization } from "@/lib/auth-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface CurrentPlanCardProps {
  planSlug: PlanSlug;
  subscriptionStatus: string;
  usedCredits: number;
  monthlyCredits: number;
  creditsResetDate?: Date;
  subscriptionEndDate?: Date;
  organizationId: string;
  currentUsage?: {
    agents: number;
    organizations: number;
    whatsappConnections: number;
    facebookConnections: number;
    tiktokConnections: number;
    instagramConnections: number;
  };
}

interface OrganizationData {
  subscriptionPlan: PlanSlug;
  subscriptionStatus: string;
  usedCredits: number;
  monthlyCredits: number;
  creditsResetDate?: Date;
  subscriptionEndDate?: Date;
}

export function CurrentPlanCard({
  planSlug: initialPlanSlug,
  subscriptionStatus: initialSubscriptionStatus,
  usedCredits: initialUsedCredits,
  monthlyCredits: initialMonthlyCredits,
  creditsResetDate: initialCreditsResetDate,
  subscriptionEndDate: initialSubscriptionEndDate,
  organizationId,
  currentUsage = {
    agents: 0,
    organizations: 1,
    whatsappConnections: 0,
    facebookConnections: 0,
    tiktokConnections: 0,
    instagramConnections: 0,
  },
}: CurrentPlanCardProps) {

  const { data: orgData } = useQuery<OrganizationData>({
    queryKey: ["organization", organizationId],
    queryFn: async () => {
      const orgs = await organization.list();
      const org = orgs?.data?.find((o) => o.id === organizationId);
      
      if (!org) throw new Error("Organization not found");
      
      return {
        subscriptionPlan: (org.subscriptionPlan as PlanSlug) || "free",
        subscriptionStatus: org.subscriptionStatus || "inactive",
        usedCredits: org.usedCredits || 0,
        monthlyCredits: org.monthlyCredits || 0,
        creditsResetDate: org.creditsResetDate,
        subscriptionEndDate: org.subscriptionEndDate,
      };
    },
    initialData: {
      subscriptionPlan: initialPlanSlug,
      subscriptionStatus: initialSubscriptionStatus,
      usedCredits: initialUsedCredits,
      monthlyCredits: initialMonthlyCredits,
      creditsResetDate: initialCreditsResetDate,
      subscriptionEndDate: initialSubscriptionEndDate,
    },
    refetchInterval: (query) => {
      const status = query.state.data?.subscriptionStatus;
      return status === "pending" || status === "processing" ? 3000 : 30000;
    },
    refetchIntervalInBackground: false,
  });

  const planSlug = orgData?.subscriptionPlan || initialPlanSlug;
  const subscriptionStatus = orgData?.subscriptionStatus || initialSubscriptionStatus;
  const usedCredits = orgData?.usedCredits || initialUsedCredits;
  const monthlyCredits = orgData?.monthlyCredits || initialMonthlyCredits;
  const creditsResetDate = orgData?.creditsResetDate || initialCreditsResetDate;
  const subscriptionEndDate = orgData?.subscriptionEndDate || initialSubscriptionEndDate;

  const plan = getPlanBySlug(planSlug);
  const creditsPercentage = monthlyCredits > 0 ? (usedCredits / monthlyCredits) * 100 : 0;
  const remainingCredits = Math.max(0, monthlyCredits - usedCredits);

  // Calculate usage and limits
  const usageItems = [
    {
      label: "Agents",
      icon: Users,
      current: currentUsage.agents,
      limit: plan?.limits.agents || 0,
      remaining: getRemainingQuota(planSlug, "agents", currentUsage.agents),
      canCreateMore: canCreateResource(planSlug, "agents", currentUsage.agents),
    },
    {
      label: "Organizations",
      icon: Building,
      current: currentUsage.organizations,
      limit: plan?.limits.organizations || 1,
      remaining: getRemainingQuota(planSlug, "organizations", currentUsage.organizations),
      canCreateMore: canCreateResource(planSlug, "organizations", currentUsage.organizations),
    },
    {
      label: "WhatsApp",
      icon: MessageSquare,
      current: currentUsage.whatsappConnections,
      limit: plan?.limits.whatsappConnections || 0,
      remaining: getRemainingQuota(planSlug, "whatsappConnections", currentUsage.whatsappConnections),
      canCreateMore: canCreateResource(planSlug, "whatsappConnections", currentUsage.whatsappConnections),
    },
    {
      label: "Facebook",
      icon: MessageSquare,
      current: currentUsage.facebookConnections,
      limit: plan?.limits.facebookConnections || 0,
      remaining: getRemainingQuota(planSlug, "facebookConnections", currentUsage.facebookConnections),
      canCreateMore: canCreateResource(planSlug, "facebookConnections", currentUsage.facebookConnections),
    },
    {
      label: "TikTok",
      icon: Zap,
      current: currentUsage.tiktokConnections,
      limit: plan?.limits.tiktokConnections || 0,
      remaining: getRemainingQuota(planSlug, "tiktokConnections", currentUsage.tiktokConnections),
      canCreateMore: canCreateResource(planSlug, "tiktokConnections", currentUsage.tiktokConnections),
    },
    {
      label: "Instagram",
      icon: Zap,
      current: currentUsage.instagramConnections,
      limit: plan?.limits.instagramConnections || 0,
      remaining: getRemainingQuota(planSlug, "instagramConnections", currentUsage.instagramConnections),
      canCreateMore: canCreateResource(planSlug, "instagramConnections", currentUsage.instagramConnections),
    },
  ];

  // Portal mutation
  const portalMutation = useMutation({
    mutationFn: async () => {
      await authClient.customer.portal();
    },
    onError: (error) => {
      toast.error("Failed to open customer portal", {
        description: error instanceof Error ? error.message : "Please try again later.",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/10 text-green-600 border-green-500/20";
      case "trialing":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "pending":
      case "processing":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      case "past_due":
        return "bg-red-500/10 text-red-600 border-red-500/20";
      case "canceled":
        return "bg-gray-500/10 text-gray-600 border-gray-500/20";
      default:
        return "bg-gray-500/10 text-gray-600 border-gray-500/20";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
      case "processing":
        return "Processing";
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Plan Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Current Plan
            </CardTitle>
            <div className="flex items-center gap-2">
              {plan?.badge && (
                <Badge variant="secondary" className="bg-blue-500/10 text-blue-600">
                  {plan.badge}
                </Badge>
              )}
              <Badge variant="outline" className={getStatusColor(subscriptionStatus)}>
                {(subscriptionStatus === "pending" || subscriptionStatus === "processing") && (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                )}
                {getStatusLabel(subscriptionStatus)}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{plan?.name || planSlug}</span>
              {plan && (
                <span className="text-2xl font-bold">
                  ${plan.price.monthly}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{plan?.description}</p>
          </div>

          {/* Plan Features */}
          {plan && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Plan Features:</h4>
              <ul className="grid grid-cols-1 gap-1 text-sm text-muted-foreground">
                {plan.features.slice(0, 4).map((feature, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    {feature}
                  </li>
                ))}
                {plan.features.length > 4 && (
                  <li className="text-xs text-muted-foreground">
                    +{plan.features.length - 4} more features
                  </li>
                )}
              </ul>
            </div>
          )}

          {subscriptionEndDate && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                {subscriptionStatus === "canceled" ? "Ends on" : "Renews on"} {formatDate(subscriptionEndDate)}
              </span>
            </div>
          )}

          {(subscriptionStatus === "pending" || subscriptionStatus === "processing") && (
            <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
              <p className="text-sm text-blue-600">
                Your subscription is being processed. This may take a few moments.
              </p>
            </div>
          )}

          <Button
            variant="outline"
            className="w-full"
            onClick={() => portalMutation.mutate()}
            disabled={portalMutation.isPending}
          >
            {portalMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Opening...
              </>
            ) : (
              <>
                <ExternalLink className="mr-2 h-4 w-4" />
                Manage Subscription
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Credits Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Credits Usage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Used this month</span>
              <span className="font-medium">
                {usedCredits.toLocaleString()} / {monthlyCredits.toLocaleString()}
              </span>
            </div>
            <Progress value={creditsPercentage} className="h-2" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Remaining</p>
              <p className="text-xl font-bold">{remainingCredits.toLocaleString()}</p>
            </div>
            {creditsResetDate && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Resets on</p>
                <p className="text-sm font-medium">
                  {formatDate(creditsResetDate)}
                </p>
              </div>
            )}
          </div>

          {creditsPercentage > 80 && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
              <p className="text-sm text-amber-600">
                You're running low on credits. Consider upgrading your plan.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resource Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Resource Usage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {usageItems.map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {item.current} / {item.limit}
                  </span>
                  {!item.canCreateMore && (
                    <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-xs">
                      Limit Reached
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>

          {usageItems.some(item => !item.canCreateMore) && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
              <p className="text-sm text-amber-600">
                You've reached limits on some resources. Upgrade your plan for more capacity.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}