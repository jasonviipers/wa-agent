"use client";

import { ArrowRight, Check, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import {
    parseAsArrayOf,
    parseAsInteger,
    parseAsString,
    useQueryState,
} from "nuqs";
import { useState } from "react";
import { toast } from "sonner";
import { WaLogo } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { organization } from "@/lib/auth-client";
import {
    BusinessTypes,
    PlatformsList,
    PrimaryGoals,
    SalesVolumes,
    TeamSizes
} from "@/lib/constants";
import type { SessionData } from "@/lib/actions/helper";
import type { Organization } from "better-auth/plugins";
import { getDomainName } from "@/lib/utils";

interface OnboardingProps {
    session: SessionData;
    organizations: Organization[];
}

const businessTypeMap: Record<string, string> = {
    ecommerce: "ecommerce_store",
    dropshipping: "dropshipping",
    agency: "marketing_agency",
    brand: "brand_manufacturer",
    individual: "individual_seller",
    other: "other",
};

const teamSizeMap: Record<string, string> = {
    solo: "solo",
    small: "small_2_5",
    medium: "medium_6_20",
    large: "large_20_plus",
};

const salesVolumeMap: Record<string, string> = {
    starter: "starting_out",
    growing: "growing_1_10",
    scale: "scaling_10_100",
    enterprise: "enterprise_100_plus",
};

const primaryGoalMap: Record<string, string> = {
    automation: "full_automation",
    multichannel: "multi_channel_expansion",
    conversion: "increase_conversion",
    efficiency: "operational_efficiency",
};

export function Onboarding({ session, organizations = [] }: OnboardingProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useQueryState("step", parseAsInteger.withDefault(1));
    const defaultWorkspaceName = session?.user?.name
        ? `${session.user.name}'s Workspace`
        : "";

    const [workspaceName, setWorkspaceName] = useQueryState(
        "name",
        parseAsString.withDefault(defaultWorkspaceName)
    );
    const [workspaceSlug, setWorkspaceSlug] = useQueryState(
        "slug",
        parseAsString.withDefault("")
    );
    const [businessType, setBusinessType] = useQueryState(
        "type",
        parseAsString.withDefault("")
    );
    const [platforms, setPlatforms] = useQueryState(
        "platforms",
        parseAsArrayOf(parseAsString).withDefault([])
    );
    const [salesVolume, setSalesVolume] = useQueryState(
        "volume",
        parseAsString.withDefault("")
    );
    const [primaryGoal, setPrimaryGoal] = useQueryState(
        "goal",
        parseAsString.withDefault("")
    );
    const [teamSize, setTeamSize] = useQueryState(
        "team",
        parseAsString.withDefault("")
    );

    const handleWorkspaceNameChange = (value: string) => {
        setWorkspaceName(value);
        const slug = value
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, "");
        setWorkspaceSlug(slug);
    };

    const domainName = getDomainName(process.env.NEXT_PUBLIC_APP_URL as string);

    const togglePlatform = (platform: string) => {
        setPlatforms(
            platforms.includes(platform)
                ? platforms.filter((p) => p !== platform)
                : [...platforms, platform]
        );
    };

    const handleCreateWorkspace = async () => {
        if (!workspaceName || !workspaceSlug) return;
        const optimisticWorkspace = {
            id: `temp-${Date.now()}`,
            name: workspaceName,
            slug: workspaceSlug,
            status: "creating",
            url: `${domainName}/${workspaceSlug}`,
        };
        toast.success(`Creating "${workspaceName}"...`);
        setIsLoading(true);
        router.replace(`/workspace`);
        try {
            const result = await organization.create({
                name: workspaceName,
                slug: workspaceSlug,
                businessType: businessTypeMap[businessType],
                teamSize: teamSizeMap[teamSize],
                salesVolume: salesVolumeMap[salesVolume],
                aiStrategy: primaryGoalMap[primaryGoal],
                workspaceUrl: optimisticWorkspace.url,
                onboardingCompleted: true,
                onboardingStep: 6,
                settings: JSON.stringify({
                    platforms,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    currency: "USD",
                    language: "en",
                }),
                keepCurrentActiveOrganization: false,
            });
            if (result.error || !result.data) {
                throw new Error(result.error?.message || "Failed to create organization");
            }

            // Update the active organization post-success
            await organization.setActive({
                organizationId: result.data.id,
            });

            toast.success(`Workspace "${workspaceName}" is ready!`);
            // Clear all onboarding query params
            await Promise.all([
                setStep(null),
                setWorkspaceName(null),
                setWorkspaceSlug(null),
                setBusinessType(null),
                setPlatforms(null),
                setSalesVolume(null),
                setPrimaryGoal(null),
                setTeamSize(null),
            ]);
        } catch (error) {
            console.error("Workspace creation failed:", error);
            toast.error(
                error instanceof Error
                    ? `Failed to create workspace: ${error.message}`
                    : "Workspace creation failed. Please retry."
            );
            // Rollback: redirect back to onboarding
            router.replace(`/onboarding?step=6`);
            setIsLoading(false);
        }
    }

    const totalSteps = 6;
    return (
        <div className="min-h-screen bg-linear-to-br from-background to-muted/20">
            <div className="container mx-auto max-w-4xl px-6 py-12">
                {/* Header */}
                <div className="mb-12 text-center">
                    <div className="mb-4 flex justify-center">
                        <div className="relative">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl">
                                <WaLogo className="h-12 w-12 text-white" />
                            </div>
                            <Badge className="-top-1 -right-4 absolute bg-primary font-medium text-white text-xs hover:bg-green-400">
                                Beta
                            </Badge>
                        </div>
                    </div>
                    <h1 className="mb-4 bg-linear-to-br from-foreground to-foreground/70 bg-clip-text font-bold text-4xl text-transparent tracking-tight">
                        Welcome, {session?.user?.name || "there"}!
                    </h1>
                    <p className="mx-auto max-w-2xl text-muted-foreground text-xl">
                        Set up your autonomous AI agents to sell across multiple platforms
                        24/7
                    </p>

                    {/* Show if user has existing incomplete organizations */}
                    {organizations && organizations.length > 0 && (
                        <p className="mt-2 text-sm text-muted-foreground">
                            Complete your workspace setup to get started
                        </p>
                    )}
                </div>

                {/* Progress Steps */}
                <div className="mb-12 flex justify-center">
                    <div className="flex items-center space-x-4">
                        {Array.from({ length: totalSteps }).map((_, index) => {
                            const stepNumber = index + 1;
                            return (
                                <div className="flex items-center" key={stepNumber}>
                                    <div
                                        className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${step >= stepNumber
                                            ? "border-primary bg-primary text-primary-foreground"
                                            : "border-muted-foreground/30 text-muted-foreground"
                                            }`}
                                    >
                                        {step > stepNumber ? (
                                            <Check className="h-5 w-5" />
                                        ) : (
                                            stepNumber
                                        )}
                                    </div>
                                    {stepNumber < totalSteps && (
                                        <div
                                            className={`h-1 w-12 rounded-full transition-all duration-300 ${step > stepNumber
                                                ? "bg-linear-to-r from-primary to-primary/80"
                                                : "bg-muted-foreground/30"
                                                }`}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Step 1: Workspace Basics */}
                {step === 1 && (
                    <Card className="mx-auto max-w-2xl border-0 shadow-xl">
                        <CardHeader className="pb-4 text-center">
                            <CardTitle className="bg-linear-to-br from-foreground to-foreground/70 bg-clip-text text-2xl text-transparent">
                                Your AI Workspace
                            </CardTitle>
                            <CardDescription className="text-lg">
                                Name your autonomous sales headquarters
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label
                                        className="font-semibold text-base"
                                        htmlFor="workspaceName"
                                    >
                                        Workspace Name
                                    </Label>
                                    <Input
                                        className="h-12 text-lg"
                                        id="workspaceName"
                                        onChange={(e) => handleWorkspaceNameChange(e.target.value)}
                                        placeholder="AI Sales Co."
                                        value={workspaceName}
                                    />
                                    {session?.user?.email && (
                                        <p className="text-muted-foreground text-sm">
                                            Using account: {session.user.email}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label
                                        className="font-semibold text-base"
                                        htmlFor="workspaceSlug"
                                    >
                                        Workspace URL
                                    </Label>
                                    <div className="flex items-center space-x-2">
                                        <span className="whitespace-nowrap rounded-lg border bg-muted px-3 py-2 text-muted-foreground text-sm">
                                            {`${domainName}/`}
                                        </span>
                                        <Input
                                            className="flex-1"
                                            id="workspaceSlug"
                                            onChange={(e) => setWorkspaceSlug(e.target.value)}
                                            placeholder="ai-sales-co"
                                            value={workspaceSlug}
                                        />
                                    </div>
                                    <p className="text-muted-foreground text-sm">
                                        Your AI agents will operate from this URL
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-between pt-4">
                                <div />
                                <Button
                                    className="min-w-32"
                                    disabled={!workspaceName.trim()}
                                    onClick={() => setStep(2)}
                                >
                                    Continue
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Step 2: Business Type */}
                {step === 2 && (
                    <Card className="mx-auto max-w-4xl border-0 shadow-xl">
                        <CardHeader className="pb-4 text-center">
                            <CardTitle className="bg-linear-to-br from-foreground to-foreground/70 bg-clip-text text-2xl text-transparent">
                                Business Type
                            </CardTitle>
                            <CardDescription className="text-lg">
                                What kind of business are you running?
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <Label className="font-semibold text-base">
                                        Select your primary business model
                                    </Label>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                        {BusinessTypes.map((type) => {
                                            const Icon = type.icon;
                                            return (
                                                <Button
                                                    className={`h-20 flex-col gap-2 ${businessType === type.value
                                                        ? ""
                                                        : "hover:border-primary"
                                                        } transition-all`}
                                                    key={type.value}
                                                    onClick={() => setBusinessType(type.value)}
                                                    type="button"
                                                    variant={
                                                        businessType === type.value ? "default" : "outline"
                                                    }
                                                >
                                                    <Icon className="h-5 w-5" />
                                                    <span className="text-sm">{type.label}</span>
                                                </Button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-between pt-4">
                                <Button onClick={() => setStep(1)} variant="outline">
                                    Back
                                </Button>
                                <Button
                                    className="min-w-32"
                                    disabled={!businessType}
                                    onClick={() => setStep(3)}
                                >
                                    Continue
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Step 3: Team Structure */}
                {step === 3 && (
                    <Card className="mx-auto max-w-4xl border-0 shadow-xl">
                        <CardHeader className="pb-4 text-center">
                            <CardTitle className="bg-linear-to-br from-foreground to-foreground/70 bg-clip-text text-2xl text-transparent">
                                Team Structure
                            </CardTitle>
                            <CardDescription className="text-lg">
                                Tell us about your team size and setup
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <Label className="font-semibold text-base">
                                        How many people are on your team?
                                    </Label>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        {TeamSizes.map((size) => (
                                            <Button
                                                className={`h-16 justify-start ${teamSize === size.value ? "" : "hover:border-primary"
                                                    } transition-all`}
                                                key={size.value}
                                                onClick={() => setTeamSize(size.value)}
                                                type="button"
                                                variant={
                                                    teamSize === size.value ? "default" : "outline"
                                                }
                                            >
                                                <div className="text-left">
                                                    <div className="font-medium">{size.label}</div>
                                                    <div className="text-xs opacity-80">
                                                        {size.description}
                                                    </div>
                                                </div>
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between pt-4">
                                <Button onClick={() => setStep(2)} variant="outline">
                                    Back
                                </Button>
                                <Button
                                    className="min-w-32"
                                    disabled={!teamSize}
                                    onClick={() => setStep(4)}
                                >
                                    Continue
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Step 4: Sales Platforms */}
                {step === 4 && (
                    <Card className="mx-auto max-w-4xl border-0 shadow-xl">
                        <CardHeader className="pb-4 text-center">
                            <CardTitle className="bg-linear-to-br from-foreground to-foreground/70 bg-clip-text text-2xl text-transparent">
                                Choose Your Sales Platforms
                            </CardTitle>
                            <CardDescription className="text-lg">
                                Where do you want your AI agents to sell?
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <Label className="font-semibold text-base">
                                        Select all platforms that apply
                                        <span className="ml-2 font-normal text-muted-foreground text-sm">
                                            (You can add more later)
                                        </span>
                                    </Label>
                                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                                        {PlatformsList.map((platform) => {
                                            const Icon = platform.icon;
                                            return (
                                                <div
                                                    className={`relative cursor-pointer rounded-lg border-2 p-4 transition-all ${platforms.includes(platform.id)
                                                        ? "border-primary bg-primary shadow-md dark:bg-primary/20"
                                                        : "border-muted hover:border-primary"
                                                        }`}
                                                    key={platform.id}
                                                    onClick={() => togglePlatform(platform.id)}
                                                >
                                                    <div className="flex items-center space-x-3">
                                                        <div
                                                            className={`rounded-lg p-2 ${platforms.includes(platform.id)
                                                                ? "bg-primary"
                                                                : "bg-muted text-muted-foreground"
                                                                }`}
                                                        >
                                                            <Icon className="h-4 w-4" />
                                                        </div>
                                                        <span className="font-medium text-sm">
                                                            {platform.name}
                                                        </span>
                                                    </div>
                                                    {platforms.includes(platform.id) && (
                                                        <div className="absolute top-2 right-2 h-3 w-3 rounded-full bg-primary" />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between pt-4">
                                <Button onClick={() => setStep(3)} variant="outline">
                                    Back
                                </Button>
                                <Button
                                    className="min-w-32"
                                    disabled={platforms.length === 0}
                                    onClick={() => setStep(5)}
                                >
                                    Continue
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Step 5: Sales Volume */}
                {step === 5 && (
                    <Card className="mx-auto max-w-4xl border-0 shadow-xl">
                        <CardHeader className="pb-4 text-center">
                            <CardTitle className="bg-linear-to-br from-foreground to-foreground/70 bg-clip-text text-2xl text-transparent">
                                Your Current Sales Volume
                            </CardTitle>
                            <CardDescription className="text-lg">
                                This helps us optimize your AI agent performance
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <Label className="font-semibold text-base">
                                        How many sales do you currently process?
                                    </Label>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        {SalesVolumes.map((volume) => (
                                            <Button
                                                className={`h-20 justify-start ${salesVolume === volume.value
                                                    ? ""
                                                    : "hover:border-primary"
                                                    } transition-all`}
                                                key={volume.value}
                                                onClick={() => setSalesVolume(volume.value)}
                                                type="button"
                                                variant={
                                                    salesVolume === volume.value ? "default" : "outline"
                                                }
                                            >
                                                <div className="text-left">
                                                    <div className="font-medium">{volume.label}</div>
                                                    <div className="text-xs opacity-80">
                                                        {volume.description}
                                                    </div>
                                                </div>
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between pt-4">
                                <Button onClick={() => setStep(4)} variant="outline">
                                    Back
                                </Button>
                                <Button
                                    className="min-w-32"
                                    disabled={!salesVolume}
                                    onClick={() => setStep(6)}
                                >
                                    Continue
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Step 6: Primary Goal */}
                {step === 6 && (
                    <Card className="mx-auto max-w-4xl border-0 shadow-xl">
                        <CardHeader className="pb-4 text-center">
                            <CardTitle className="bg-linear-to-br from-foreground to-foreground/70 bg-clip-text text-2xl text-transparent">
                                Define Your AI Strategy
                            </CardTitle>
                            <CardDescription className="text-lg">
                                What should your AI sales agents focus on?
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <Label className="font-semibold text-base">
                                        Primary goal for your AI agents
                                    </Label>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        {PrimaryGoals.map((goal) => {
                                            const Icon = goal.icon;
                                            return (
                                                <Button
                                                    className={`h-24 justify-start ${primaryGoal === goal.value
                                                        ? ""
                                                        : "hover:border-primary"
                                                        } transition-all`}
                                                    key={goal.value}
                                                    onClick={() => setPrimaryGoal(goal.value)}
                                                    type="button"
                                                    variant={
                                                        primaryGoal === goal.value ? "default" : "outline"
                                                    }
                                                >
                                                    <div className="flex items-start space-x-3 text-left">
                                                        <Icon className="mt-1 h-5 w-5 shrink-0" />
                                                        <div>
                                                            <div className="font-medium">{goal.label}</div>
                                                            <div className="text-xs opacity-80">
                                                                {goal.description}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </Button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between pt-4">
                                <Button onClick={() => setStep(5)} variant="outline">
                                    Back
                                </Button>
                                <Button
                                    className="min-w-32 shadow-lg"
                                    disabled={isLoading || !primaryGoal}
                                    onClick={handleCreateWorkspace}
                                >
                                    {isLoading ? (
                                        <>
                                            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-current border-b-2" />
                                            Deploying AI Agents...
                                        </>
                                    ) : (
                                        <>
                                            Launch AI Sales Team
                                            <Sparkles className="ml-2 h-4 w-4" />
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}