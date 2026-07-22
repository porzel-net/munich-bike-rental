"use client";

import { passkeyClient } from "@better-auth/passkey/client";
import { createAuthClient } from "better-auth/react";
import { adminClient, twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    adminClient(),
    twoFactorClient({
      twoFactorPage: "/admin/two-factor",
      onTwoFactorRedirect: () => {
        window.location.assign("/admin/two-factor");
      },
    }),
    passkeyClient(),
  ],
});
