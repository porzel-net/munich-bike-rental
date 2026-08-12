import { headers } from "next/headers";

import { auth } from "../auth";
export {
  canAccessAdmin,
  canAccessLocation,
  canUseAdminApi,
  canUseAdminApiAsAdmin,
  getAssignedLocation,
  getVisibleLocationScope,
  hasCompletedAdminSetup,
  isAdmin,
  isLocationUser,
} from "./authorization";

export async function getServerSession() {
  return auth.api.getSession({ headers: await headers() });
}
