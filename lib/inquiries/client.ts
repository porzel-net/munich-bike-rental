export type InquiryResult = {
  ok?: boolean;
  error?: string;
  code?: string;
  orderNumber?: string;
};

export async function postInquiry(path: "/api/contact" | "/api/maintenance", payload: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = (await response.json().catch(() => null)) as InquiryResult | null;
  return { response, result };
}

export function getInquiryError(
  code: string | undefined,
  validation: {
    submitOriginError: string;
    submitPayloadError: string;
    submitConfigError: string;
    submitValidationError: string;
    submitFailed: string;
  },
) {
  switch (code) {
    case "invalid_origin":
      return validation.submitOriginError;
    case "payload_too_large":
      return validation.submitPayloadError;
    case "config_incomplete":
      return validation.submitConfigError;
    case "validation_error":
      return validation.submitValidationError;
    default:
      return validation.submitFailed;
  }
}
