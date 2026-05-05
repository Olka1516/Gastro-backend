export const normalizeShowcasePlaceName = (
  raw: string | undefined,
): string => {
  if (!raw) {
    return "";
  }
  try {
    return decodeURIComponent(raw).replace(/_/g, " ").trim();
  } catch {
    return "";
  }
};
