import { headers } from "next/headers";

import { auth } from "../auth";
export {
  canAccessAdmin,
  canAccessLocation,
  canUseAdminApi,
  canUseAdminApiAsAdmin,
  getAssignedLocation,
  hasCompletedAdminSetup,
  isAdmin,
  isLocationUser,
} from "./authorization";

export async function getServerSession() {
  return auth.api.getSession({ headers: await headers() });
}
