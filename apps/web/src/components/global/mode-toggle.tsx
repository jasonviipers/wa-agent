"use client";

import { motion } from "framer-motion";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export function ModeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  if (!mounted) {
    return (
      <Button
        className="relative size-10 overflow-hidden rounded-full"
        disabled
        size="icon"
        variant="outline"
      >
        <div className="h-[1.2rem] w-[1.2rem]" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  return (
    <Button
      className="relative size-10 overflow-hidden rounded-full"
      onClick={toggleTheme}
      size="icon"
      variant="outline"
    >
      <motion.div
        animate={{
          rotate: theme === "dark" ? 180 : 0,
          scale: theme === "dark" ? 0 : 1,
        }}
        className="absolute"
        initial={false}
        transition={{
          duration: 0.3,
          ease: "easeInOut",
        }}
      >
        <SunIcon className="h-[1.2rem] w-[1.2rem]" />
      </motion.div>
      <motion.div
        animate={{
          rotate: theme === "dark" ? 0 : -180,
          scale: theme === "dark" ? 1 : 0,
        }}
        className="absolute"
        initial={false}
        transition={{
          duration: 0.3,
          ease: "easeInOut",
        }}
      >
        <MoonIcon className="h-[1.2rem] w-[1.2rem]" />
      </motion.div>
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
