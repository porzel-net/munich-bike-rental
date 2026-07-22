import { z } from "zod";

export const invitationRegistrationSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.email().max(320),
  password: z
    .string()
    .min(16)
    .max(128)
    .regex(/[a-z]/)
    .regex(/[A-Z]/)
    .regex(/\d/)
    .regex(/[^A-Za-z0-9]/),
});

/** Admin-created invitations lock the stored name; bootstrap invitations use the submitted name. */
export function resolveInvitationName(storedName: string, submittedName?: string) {
  const name = storedName || submittedName?.trim();
  return name && name.length >= 2 && name.length <= 120 ? name : null;
}
