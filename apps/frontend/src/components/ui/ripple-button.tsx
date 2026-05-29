"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Ripple {
  x: number;
  y: number;
  id: number;
}

interface RippleButtonProps extends React.ComponentProps<typeof Button> {
  glow?: boolean;
}

export function RippleButton({ className, children, glow = true, onClick, ...props }: RippleButtonProps) {
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const id = Date.now();

    setRipples((prev) => [...prev, { x, y, id }]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((ripple) => ripple.id !== id));
    }, 600);

    onClick?.(event);
  };

  return (
    <Button
      onClick={handleClick}
      className={cn(
        "relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 px-4 py-2.5 text-white shadow-md transition duration-300",
        glow && "hover:shadow-glow dark:hover:shadow-glow-dark-lg",
        "dark:from-[hsl(28,78%,48%)] dark:to-[hsl(26,72%,54%)] dark:shadow-glow-dark",
        className
      )}
      {...props}
    >
      {children}
      {ripples.map((ripple) => (
        <motion.span
          key={ripple.id}
          initial={{ scale: 0, opacity: 0.5 }}
          animate={{ scale: 4, opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="absolute h-10 w-10 rounded-full bg-white/50"
          style={{ left: ripple.x - 20, top: ripple.y - 20 }}
        />
      ))}
    </Button>
  );
}
