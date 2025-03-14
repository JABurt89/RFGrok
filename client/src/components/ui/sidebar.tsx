import * as React from "react";
import { cn } from "@/lib/utils";
import { useMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";

type SidebarProps = React.HTMLAttributes<HTMLDivElement> & {
  isOpen?: boolean;
  onToggle?: () => void;
};

export function Sidebar({ children, className, isOpen, onToggle, ...props }: SidebarProps) {
  const isMobile = useMobile();

  return (
    <>
      {/* Mobile Sheet */}
      {isMobile && (
        <Sheet open={isOpen} onOpenChange={onToggle}>
          <SheetContent side="left" className="p-0 w-[300px]">
            <div className="flex flex-col flex-1 min-h-0 bg-background">
              {children}
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Desktop Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex flex-col w-64 transition-transform duration-300",
          isMobile ? "hidden" : "block",
          className
        )}
        {...props}
      >
        <div className="flex flex-col flex-1 min-h-0 bg-background border-r">
          {children}
        </div>
      </div>
    </>
  );
}