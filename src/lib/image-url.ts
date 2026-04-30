export function isValidImageUrl(value?: string | null) {
  const urlText = value?.trim();
  if (!urlText) return true;

  try {
    const url = new URL(urlText);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
