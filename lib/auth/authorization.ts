import { rentalLocations, type RentalLocation } from "../inquiries/catalog";

export const adminRoles = ["admin", "standortuser"] as const;
export type AdminRole = (typeof adminRoles)[number];

type AuthorizedUser = {
  locationKey?: string | null;
  role?: string | null;
};

export function hasRole(user: AuthorizedUser, role: AdminRole) {
  return user.role?.split(",").includes(role) ?? false;
}

export function isAdmin(user: AuthorizedUser) {
  return hasRole(user, "admin");
}

export function isLocationUser(user: AuthorizedUser) {
  return hasRole(user, "standortuser");
}

export function getAssignedLocation(user: AuthorizedUser): RentalLocation | null {
  if (!isLocationUser(user) || !user.locationKey) return null;
  return rentalLocations.includes(user.locationKey as RentalLocation) ? (user.locationKey as RentalLocation) : null;
}

export function canAccessAdmin(user: AuthorizedUser) {
  return isAdmin(user) || getAssignedLocation(user) !== null;
}

export function canAccessLocation(user: AuthorizedUser, location: RentalLocation) {
  return isAdmin(user) || getAssignedLocation(user) === location;
}
