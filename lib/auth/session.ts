import { headers } from "next/headers";

import { auth } from "../auth";
export { canAccessAdmin, canAccessLocation, getAssignedLocation, isAdmin, isLocationUser } from "./authorization";

export async function getServerSession() {
  return auth.api.getSession({ headers: await headers() });
}
