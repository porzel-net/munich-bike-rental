import { headers } from "next/headers";

import { auth } from "../auth";
export {
  canAccessAdmin,
  canAccessLocation,
  canReceiveOperationalNotifications,
  canUseAdminApi,
  canUseAdminApiAsAdmin,
  getAssignedLocation,
  getVisibleLocationScope,
  hasCompletedAdminSetup,
  isAccountBlocked,
  isAdmin,
  isLocationUser,
} from "./authorization";

export async function getServerSession() {
  return auth.api.getSession({ headers: await headers() });
}
