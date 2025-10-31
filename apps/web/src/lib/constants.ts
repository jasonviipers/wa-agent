import {
  Bot,
  Building,
  MessageCircle,
  ShoppingCart,
  Store,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

const AUTH_ERROR_MESSAGES = {
  invalid_email: "Please enter a valid email address",
  user_not_found: "No account found with this email",
  rate_limited: "Too many attempts. Please try again later",
  network_error: "Network error. Please check your connection",
  passkey_not_supported:
    "Passkey authentication is not supported on this device",
  cancelled: "Authentication was cancelled",
} as const;

const LOADING_MESSAGES = {
  magicLink: "Sending magic link...",
  passkey: "Authenticating...",
  github: "Connecting...",
  google: "Connecting...",
} as const;

const AUTH_BUTTON_TEXT = {
  magicLink: "Sign in with Magic Link",
  passkey: "Sign in with Passkey",
  github: "GitHub",
  google: "Google",
} as const;

export { AUTH_ERROR_MESSAGES, LOADING_MESSAGES, AUTH_BUTTON_TEXT };

export type AuthErrorMessages = typeof AUTH_ERROR_MESSAGES;
export type LoadingMessages = typeof LOADING_MESSAGES;
export type AuthButtonText = typeof AUTH_BUTTON_TEXT;

export type SocialProvider = "github" | "google";
export type AuthMethod = "magicLink" | "passkey" | SocialProvider;
export type LastUsedMethod = "email" | "passkey" | SocialProvider;

export const BusinessTypes = [
  { value: "ecommerce", label: "E-commerce Store", icon: ShoppingCart },
  { value: "dropshipping", label: "Dropshipping", icon: TrendingUp },
  { value: "agency", label: "Marketing Agency", icon: Building },
  { value: "brand", label: "Brand Manufacturer", icon: Store },
  { value: "individual", label: "Individual Seller", icon: Users },
  { value: "other", label: "Other", icon: Building },
];

export const PlatformsList = [
  { id: "shopify", name: "Shopify", icon: Store },
  { id: "facebook", name: "Facebook Marketplace", icon: MessageCircle },
  { id: "tiktok", name: "TikTok Shop", icon: TrendingUp },
  { id: "amazon", name: "Amazon", icon: ShoppingCart },
  { id: "instagram", name: "Instagram Shopping", icon: MessageCircle },
  { id: "whatsapp", name: "WhatsApp Business", icon: MessageCircle },
];

export const SalesVolumes = [
  {
    value: "starter",
    label: "Just starting out",
    description: "Testing the waters with AI sales",
  },
  {
    value: "growing",
    label: "Growing business",
    description: "1-10 sales per day",
  },
  {
    value: "scale",
    label: "Scaling rapidly",
    description: "10-100 sales per day",
  },
  {
    value: "enterprise",
    label: "Enterprise level",
    description: "100+ sales per day",
  },
];

export const PrimaryGoals = [
  {
    value: "automation",
    label: "Full automation",
    description: "Hands-off sales process",
    icon: Zap,
  },
  {
    value: "multichannel",
    label: "Multi-channel expansion",
    description: "Sell across multiple platforms",
    icon: TrendingUp,
  },
  {
    value: "conversion",
    label: "Increase conversion",
    description: "Boost sales with AI negotiation",
    icon: Target,
  },
  {
    value: "efficiency",
    label: "Operational efficiency",
    description: "Reduce manual work",
    icon: Bot,
  },
];

export const TeamSizes = [
  { value: "solo", label: "Just me", description: "Solo entrepreneur" },
  { value: "small", label: "2-5 people", description: "Small team" },
  { value: "medium", label: "6-20 people", description: "Growing team" },
  { value: "large", label: "20+ people", description: "Large organization" },
];