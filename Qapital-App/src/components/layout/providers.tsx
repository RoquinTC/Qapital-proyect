"use client";

import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      // Required for cross-origin iframe: cookies with SameSite=None
      // need credentials to be explicitly included in fetch requests
      refetchInterval={15}
      refetchOnWindowFocus={true}
    >
      {children}
    </SessionProvider>
  );
}
