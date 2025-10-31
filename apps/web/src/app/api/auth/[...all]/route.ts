import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@wagents/auth";

export const { GET, POST } = toNextJsHandler(auth.handler);
