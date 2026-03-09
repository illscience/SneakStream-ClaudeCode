export const PAST_SHOW_PRICE = 500; // $5.00 in cents
export const PAST_SHOW_MIN_DURATION = 3600; // 1 hour in seconds

export function isPastShow(video: {
  status: string;
  duration?: number;
}): boolean {
  return (
    video.status === "ready" &&
    video.duration !== undefined &&
    video.duration >= PAST_SHOW_MIN_DURATION
  );
}
