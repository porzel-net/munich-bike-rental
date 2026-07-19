"use client";

import { type FormEvent, useState } from "react";

import { useConsent } from "./consent-manager";
import { InquiryHoneypot } from "./inquiry-honeypot";
import type { Locale } from "../lib/home-content";
import { getInquiryError, postInquiry } from "../lib/inquiries/client";
import { isValidEmail } from "../lib/inquiries/schemas";

type MaintenanceFormTranslations = {
  eyebrow: string;
  title: string;
  name: string;
  contact: string;
  bikeModel: string;
  serviceType: string;
  serviceTypeOptions: {
    wax: string;
    cleaning: string;
    parts: string;
    repair: string;
    advice: string;
  };
  pickup: string;
  pickupOptions: {
    no: string;
    yes: string;
  };
  message: string;
  privacy: string;
  submit: string;
  sending: string;
  success: string;
  orderNumberLabel: string;
  error: string;
  validation: {
    contactHint: string;
    nameRequired: string;
    contactRequired: string;
    contactInvalid: string;
    bikeModelRequired: string;
    serviceTypeRequired: string;
    messageRequired: string;
    privacyRequired: string;
    submitFailed: string;
    submitOriginError: string;
    submitConfigError: string;
    submitPayloadError: string;
    submitValidationError: string;
  };
};

type MaintenanceStatus = "idle" | "sending" | "success" | "error";

type MaintenanceField = "name" | "contact" | "bikeModel" | "serviceType" | "message" | "privacy";

type MaintenanceFieldErrors = Partial<Record<MaintenanceField, string>>;

type MaintenanceValidation = {
  fieldErrors: MaintenanceFieldErrors;
  submitError: string | null;
};

type MaintenanceFormProps = {
  lang: Locale;
  translations: MaintenanceFormTranslations;
};

function validateMaintenanceForm(
  translations: MaintenanceFormTranslations,
  values: {
    name: string;
    contact: string;
    bikeModel: string;
    serviceType: string;
    message: string;
    privacyAccepted: boolean;
  },
): MaintenanceValidation {
  const validation = translations.validation;
  const fieldErrors: MaintenanceFieldErrors = {};

  if (!values.name.trim()) {
    fieldErrors.name = validation.nameRequired;
  }

  if (!values.contact.trim()) {
    fieldErrors.contact = validation.contactRequired;
  } else if (!isValidEmail(values.contact.trim())) {
    fieldErrors.contact = validation.contactInvalid;
  }

  if (!values.bikeModel.trim()) {
    fieldErrors.bikeModel = validation.bikeModelRequired;
  }

  if (!values.serviceType.trim()) {
    fieldErrors.serviceType = validation.serviceTypeRequired;
  }

  if (!values.message.trim()) {
    fieldErrors.message = validation.messageRequired;
  }

  if (!values.privacyAccepted) {
    fieldErrors.privacy = validation.privacyRequired;
  }

  return {
    fieldErrors,
    submitError: Object.keys(fieldErrors).length > 0 ? validation.submitValidationError : null,
  };
}

export function MaintenanceForm({ lang, translations }: MaintenanceFormProps) {
  const { trackLead } = useConsent();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [bikeModel, setBikeModel] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [pickupRequested, setPickupRequested] = useState(false);
  const [message, setMessage] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [status, setStatus] = useState<MaintenanceStatus>("idle");
  const [fieldErrors, setFieldErrors] = useState<MaintenanceFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  const clearFieldError = (field: MaintenanceField) => {
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
    setSubmitError(null);
    setStatus("idle");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validation = validateMaintenanceForm(translations, {
      name,
      contact,
      bikeModel,
      serviceType,
      message,
      privacyAccepted,
    });

    if (Object.keys(validation.fieldErrors).length > 0) {
      setFieldErrors(validation.fieldErrors);
      setSubmitError(validation.submitError);
      setStatus("error");
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const nameValue = String(formData.get("name") ?? "").trim();
    const contactValue = String(formData.get("contact") ?? "").trim();
    const bikeModelValue = String(formData.get("bikeModel") ?? "").trim();
    const serviceTypeValue = String(formData.get("serviceType") ?? "").trim();
    const pickupValue = formData.get("pickup") === "on";
    const messageValue = String(formData.get("message") ?? "").trim();

    setStatus("sending");
    setFieldErrors({});
    setSubmitError(null);
    setOrderNumber(null);

    try {
      const { response, result } = await postInquiry("/api/maintenance", {
        name: nameValue,
        contact: contactValue,
        bikeModel: bikeModelValue,
        serviceType: serviceTypeValue,
        pickup: pickupValue,
        message: messageValue,
        locale: lang,
        website: String(formData.get("website") ?? ""),
      });

      if (!response.ok || !result?.ok) {
        throw new Error(getInquiryError(result?.code ?? result?.error, translations.validation));
      }

      form.reset();
      setName("");
      setContact("");
      setBikeModel("");
      setServiceType("");
      setPickupRequested(false);
      setMessage("");
      setPrivacyAccepted(false);
      setFieldErrors({});
      setSubmitError(null);
      setOrderNumber(result?.orderNumber ?? null);
      setStatus("success");

      const serviceLabel =
        translations.serviceTypeOptions[serviceTypeValue as keyof MaintenanceFormTranslations["serviceTypeOptions"]] ??
        serviceTypeValue;

      trackLead({
        bikeTitle: serviceLabel || bikeModelValue || undefined,
        language: lang,
        contactMethod: "email",
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : translations.validation.submitFailed);
      setStatus("error");
    }
  };

  return (
    <form className="contact-form maintenance-form" onSubmit={handleSubmit} noValidate>
      <InquiryHoneypot />
      <div className="contact-form__fields">
        <div className="contact-form__field">
          <label htmlFor="maintenance-name">{translations.name}</label>
          <input
            id="maintenance-name"
            name="name"
            type="text"
            placeholder={translations.name}
            value={name}
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? "maintenance-name-error" : undefined}
            onChange={(event) => {
              setName(event.target.value);
              clearFieldError("name");
            }}
          />
          {fieldErrors.name ? (
            <p className="contact-form__error" id="maintenance-name-error">
              {fieldErrors.name}
            </p>
          ) : null}
        </div>

        <div className="contact-form__field">
          <label htmlFor="maintenance-contact">{translations.contact}</label>
          <input
            id="maintenance-contact"
            name="contact"
            type="email"
            placeholder={translations.contact}
            value={contact}
            aria-invalid={Boolean(fieldErrors.contact)}
            aria-describedby={
              fieldErrors.contact ? "maintenance-contact-hint maintenance-contact-error" : "maintenance-contact-hint"
            }
            onChange={(event) => {
              setContact(event.target.value);
              clearFieldError("contact");
            }}
            inputMode="email"
            autoComplete="email"
          />
          <p className="contact-form__hint" id="maintenance-contact-hint">
            {translations.validation.contactHint}
          </p>
          {fieldErrors.contact ? (
            <p className="contact-form__error" id="maintenance-contact-error">
              {fieldErrors.contact}
            </p>
          ) : null}
        </div>

        <div className="contact-form__bike-fields maintenance-form__split">
          <div className="contact-form__field">
            <label htmlFor="maintenance-bike-model">{translations.bikeModel}</label>
            <input
              id="maintenance-bike-model"
              name="bikeModel"
              type="text"
              placeholder={translations.bikeModel}
              value={bikeModel}
              aria-invalid={Boolean(fieldErrors.bikeModel)}
              aria-describedby={fieldErrors.bikeModel ? "maintenance-bike-model-error" : undefined}
              onChange={(event) => {
                setBikeModel(event.target.value);
                clearFieldError("bikeModel");
              }}
            />
            {fieldErrors.bikeModel ? (
              <p className="contact-form__error" id="maintenance-bike-model-error">
                {fieldErrors.bikeModel}
              </p>
            ) : null}
          </div>

          <div className="contact-form__field">
            <label htmlFor="maintenance-service-type">{translations.serviceType}</label>
            <select
              id="maintenance-service-type"
              name="serviceType"
              value={serviceType}
              aria-invalid={Boolean(fieldErrors.serviceType)}
              aria-describedby={fieldErrors.serviceType ? "maintenance-service-type-error" : undefined}
              onChange={(event) => {
                setServiceType(event.target.value);
                clearFieldError("serviceType");
              }}
            >
              <option value="" disabled>
                {translations.serviceType}
              </option>
              <option value="wax">{translations.serviceTypeOptions.wax}</option>
              <option value="cleaning">{translations.serviceTypeOptions.cleaning}</option>
              <option value="parts">{translations.serviceTypeOptions.parts}</option>
              <option value="repair">{translations.serviceTypeOptions.repair}</option>
              <option value="advice">{translations.serviceTypeOptions.advice}</option>
            </select>
            {fieldErrors.serviceType ? (
              <p className="contact-form__error" id="maintenance-service-type-error">
                {fieldErrors.serviceType}
              </p>
            ) : null}
          </div>
        </div>

        <div className="maintenance-form__pickup">
          <label className="contact-form__checkbox" htmlFor="maintenance-pickup">
            <input
              id="maintenance-pickup"
              name="pickup"
              type="checkbox"
              checked={pickupRequested}
              onChange={(event) => setPickupRequested(event.target.checked)}
            />
            <span>
              <strong>{translations.pickup}</strong>
              <br />
              {lang === "de"
                ? "Gegen einen kleinen Aufpreis holen wir dein Fahrrad ab und bringen es wieder zurück."
                : "For a small extra fee, we can pick up your bike and bring it back again."}
            </span>
          </label>
        </div>

        <div className="contact-form__field contact-form__field--wide">
          <label htmlFor="maintenance-message">{translations.message}</label>
          <textarea
            id="maintenance-message"
            name="message"
            placeholder={translations.message}
            value={message}
            aria-invalid={Boolean(fieldErrors.message)}
            aria-describedby={fieldErrors.message ? "maintenance-message-error" : undefined}
            onChange={(event) => {
              setMessage(event.target.value);
              clearFieldError("message");
            }}
          />
          {fieldErrors.message ? (
            <p className="contact-form__error" id="maintenance-message-error">
              {fieldErrors.message}
            </p>
          ) : null}
        </div>
      </div>

      <label className="contact-form__checkbox" htmlFor="maintenance-privacy">
        <input
          id="maintenance-privacy"
          name="privacy"
          type="checkbox"
          checked={privacyAccepted}
          aria-invalid={Boolean(fieldErrors.privacy)}
          aria-describedby={fieldErrors.privacy ? "maintenance-privacy-error" : undefined}
          onChange={(event) => {
            setPrivacyAccepted(event.target.checked);
            clearFieldError("privacy");
          }}
        />
        <span>{translations.privacy}</span>
      </label>
      {fieldErrors.privacy ? (
        <p className="contact-form__error" id="maintenance-privacy-error">
          {fieldErrors.privacy}
        </p>
      ) : null}

      <button type="submit" className="button--arrow" disabled={status === "sending"}>
        <span>{status === "sending" ? translations.sending : translations.submit}</span>
        <img src="/assets/img/svg/right-arrow.svg" alt="" />
      </button>

      <p
        aria-live="polite"
        className={`contact-form__status ${status === "success" ? "is-success" : ""} ${status === "error" ? "is-error" : ""}`}
      >
        {status === "success" ? (
          <>
            {translations.success}
            {orderNumber ? (
              <>
                {" "}
                <strong>
                  {translations.orderNumberLabel}: {orderNumber}
                </strong>
              </>
            ) : null}
          </>
        ) : submitError ? (
          submitError
        ) : null}
      </p>
    </form>
  );
}
