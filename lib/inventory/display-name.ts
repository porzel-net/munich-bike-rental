/**
 * Public-facing bike names must never contain the internal nickname.
 */
export function formatBikeDisplayName(title: string, size: string) {
  return `${title} - ${size}`;
}

export function bikeMatchesRequestedLabel(asset: { modelTitle: string; size: string }, requestedLabel: string) {
  // Inquiry labels may include the rider's height, e.g. "Model (180 cm)".
  // That is a fit hint, not a frame-size or model identifier.
  const requested = requestedLabel
    .trim()
    .replace(/\s*\(\s*\d+(?:[.,]\d+)?\s*cm\s*\)\s*$/i, "")
    .trim();
  const separatorIndex = requested.lastIndexOf(" - ");
  const requestedModel = separatorIndex === -1 ? requested : requested.slice(0, separatorIndex).trim();
  const requestedSize = separatorIndex === -1 ? null : requested.slice(separatorIndex + 3).trim();

  return (
    requestedModel === asset.modelTitle &&
    (requestedSize === null || requestedSize.toLocaleLowerCase() === asset.size.toLocaleLowerCase())
  );
}
