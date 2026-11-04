/**
 * Sisense allows widgets and dashboards to be saved with a blank title. Use
 * this wherever a title is displayed or matched against, so an untitled item
 * still has something sensible to show/search by instead of an empty string.
 */
export function getDisplayTitle(title: string | null | undefined, fallback: string): string {
  return title?.trim() ? title : fallback;
}
