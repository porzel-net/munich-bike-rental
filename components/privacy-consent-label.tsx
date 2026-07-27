import Link from "next/link";

type PrivacyConsentLabelProps = {
  label: string;
  linkText?: string;
  href?: string;
};

export function PrivacyConsentLabel({ label, linkText, href = "/datenschutzerklaerung" }: PrivacyConsentLabelProps) {
  const linkedLabel = linkText ?? (label.includes("Datenschutzerklärung") ? "Datenschutzerklärung" : "privacy policy");

  if (!label.includes(linkedLabel)) {
    return label;
  }

  const [before, after] = label.split(linkedLabel);

  return (
    <>
      {before}
      <Link href={href}>{linkedLabel}</Link>
      {after}
    </>
  );
}
