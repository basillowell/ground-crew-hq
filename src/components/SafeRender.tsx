import { ReactNode } from "react";

type SafeRenderProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

export function SafeRender({ children, fallback }: SafeRenderProps) {
  try {
    return <>{children}</>;
  } catch {
    return <>{fallback ?? <div className="text-sm text-muted-foreground">Something went wrong.</div>}</>;
  }
}

