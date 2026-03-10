import { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  // DO NOT redirect to dashboard based on cookie existence
  // Middleware validates token and handles routing
  // This prevents ping-pong loops with stale/invalid tokens

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-accent/10 to-background">
      <div className="w-full max-w-md mx-auto">{children}</div>
    </div>
  );
}
