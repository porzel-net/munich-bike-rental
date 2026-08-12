export function formatBikeDisplayName(title: string, size: string, nickname?: string | null) {
  const trimmedNickname = nickname?.trim();
  if (trimmedNickname) return trimmedNickname;
  return `${title} - ${size}`;
}

export function bikeMatchesRequestedLabel(asset: { modelTitle: string; size: string }, requestedLabel: string) {
  const requested = requestedLabel.trim();
  const separatorIndex = requested.lastIndexOf(" - ");
  const requestedModel = separatorIndex === -1 ? requested : requested.slice(0, separatorIndex).trim();
  const requestedSize = separatorIndex === -1 ? null : requested.slice(separatorIndex + 3).trim();

  return (
    requestedModel === asset.modelTitle &&
    (requestedSize === null || requestedSize.toLocaleLowerCase() === asset.size.toLocaleLowerCase())
  );
}
