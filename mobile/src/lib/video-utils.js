export const PAST_SHOW_PRICE = 500;
export const PAST_SHOW_MIN_DURATION = 3600;

export function isPastShow(video) {
  return Boolean(
    video &&
      video.status === "ready" &&
      typeof video.duration === "number" &&
      video.duration >= PAST_SHOW_MIN_DURATION,
  );
}

export function getVideoPrice(video) {
  if (video?.visibility === "ppv" && typeof video?.price === "number") {
    return video.price;
  }

  return PAST_SHOW_PRICE;
}

export function getVideoThumbnailUrl(video, options = {}) {
  if (video?.thumbnailUrl) {
    return video.thumbnailUrl;
  }

  if (video?.playbackId && video?.provider === "mux") {
    const width = options.width ?? 640;
    const height = options.height ?? 360;
    return `https://image.mux.com/${video.playbackId}/thumbnail.jpg?width=${width}&height=${height}&fit_mode=smartcrop`;
  }

  return null;
}

export function getPublicPlaybackUrl(video) {
  if (video?.playbackUrl) {
    return video.playbackUrl;
  }

  if (video?.playbackId) {
    return `https://stream.mux.com/${video.playbackId}.m3u8`;
  }

  return null;
}

export function formatDuration(seconds) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function formatCompactCount(value) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  }

  return `${value}`;
}

export function formatCreationDate(timestamp) {
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
