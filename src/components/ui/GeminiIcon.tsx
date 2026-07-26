import { motion } from "motion/react";
import { cx } from "@/lib/utils";

interface GeminiIconProps {
  className?: string;
  size?: number;
  animated?: boolean;
}

export function GeminiIcon({ className, size = 16, animated = true }: GeminiIconProps) {
  const svg = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cx("shrink-0", className)}
    >
      <defs>
        <linearGradient id="gemini-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4285F4" />
          <stop offset="35%" stopColor="#9B51E0" />
          <stop offset="70%" stopColor="#E91E63" />
          <stop offset="100%" stopColor="#00C9FF" />
        </linearGradient>
      </defs>
      <path
        d="M12 2C12 7.52285 16.4771 12 22 12C16.4771 12 12 16.4771 12 22C12 16.4771 7.52285 12 2 12C7.52285 12 12 7.52285 12 2Z"
        fill="url(#gemini-grad)"
      />
      <path
        d="M18 3C18 4.65685 19.3431 6 21 6C19.3431 6 18 7.34315 18 9C18 7.34315 16.6569 6 15 6C16.6569 6 18 4.65685 18 3Z"
        fill="url(#gemini-grad)"
        opacity="0.85"
      />
    </svg>
  );

  if (!animated) return svg;

  return (
    <motion.span
      className="inline-flex items-center justify-center"
      whileHover={{
        scale: 1.15,
        rotate: 15,
        filter: "drop-shadow(0px 0px 6px rgba(155, 81, 224, 0.6))",
      }}
      whileTap={{
        scale: 0.9,
        rotate: -15,
      }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 17,
      }}
    >
      {svg}
    </motion.span>
  );
}
