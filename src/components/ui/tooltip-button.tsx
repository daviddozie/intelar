"use client";

import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type TooltipButtonProps = React.ComponentPropsWithoutRef<"button"> & {
  tooltip?: React.ReactNode;
  tooltipSide?: React.ComponentProps<typeof TooltipContent>["side"];
};

// Forward the actual button's ref and events so dropdown triggers still compose.
const TooltipButton = React.forwardRef<HTMLButtonElement, TooltipButtonProps>(
  function TooltipButton({ tooltip, tooltipSide = "top", title, children, ...props }, ref) {
    const label = tooltip === undefined ? title ?? props["aria-label"] : tooltip;
    const button = (
      <button
        {...props}
        ref={ref}
        aria-label={props["aria-label"] ?? (typeof label === "string" ? label : undefined)}
      >
        {children}
      </button>
    );

    if (!label || props.disabled) return button;

    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side={tooltipSide}>{label}</TooltipContent>
      </Tooltip>
    );
  },
);

export { TooltipButton };
