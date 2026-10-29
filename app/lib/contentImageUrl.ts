// Client-safe URL for an uploaded content image (served by app/api/content-images/[key]).
export function contentImageUrl(imageKey: string) {
  return `/api/content-images/${imageKey}`
}
