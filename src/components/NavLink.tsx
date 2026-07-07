import Link from "next/link";
import { usePathname } from "next/navigation";
import { forwardRef, type AnchorHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type NavLinkClassName =
  | string
  | ((state: { isActive: boolean; isPending: boolean }) => string | undefined);

interface NavLinkCompatProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "href"> {
  to: string;
  className?: NavLinkClassName;
  activeClassName?: string;
  pendingClassName?: string;
  end?: boolean;
}

function normalizePath(path: string) {
  const [withoutHash] = path.split("#");
  const [withoutQuery] = withoutHash.split("?");
  return withoutQuery.replace(/\/+$/, "") || "/";
}

function getIsActive(pathname: string, to: string, end?: boolean) {
  const currentPath = normalizePath(pathname);
  const targetPath = normalizePath(to);

  if (end) return currentPath === targetPath;
  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, to, end, ...props }, ref) => {
    const pathname = usePathname() ?? "/";
    const isActive = getIsActive(pathname, to, end);
    const isPending = false;
    const resolvedClassName = typeof className === "function" ? className({ isActive, isPending }) : className;

    return (
      <Link
        ref={ref}
        href={to}
        className={cn(resolvedClassName, isActive && activeClassName, isPending && pendingClassName)}
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
