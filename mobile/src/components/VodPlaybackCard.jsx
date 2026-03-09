import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useMutation } from "convex/react";
import { VideoAirPlayButton, VideoView, useVideoPlayer } from "expo-video";
import { Heart, Maximize2, Volume2, VolumeX, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "convex/_generated/api";
import { authorizedWebFetch } from "@/lib/web-api";
import {
  formatDuration,
  getPublicPlaybackUrl,
  isPastShow,
} from "@/lib/video-utils";

export default function VodPlaybackCard({ video, sessionId }) {
  const insets = useSafeAreaInsets();
  const incrementViewCount = useMutation(api.videos.incrementViewCount);
  const incrementHeartCount = useMutation(api.videos.incrementHeartCount);
  const [playbackUrl, setPlaybackUrl] = useState(() => getPublicPlaybackUrl(video));
  const [playbackError, setPlaybackError] = useState(null);
  const [isLoadingPlayback, setIsLoadingPlayback] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [heartCount, setHeartCount] = useState(video?.heartCount || 0);
  const [isHeartAnimating, setIsHeartAnimating] = useState(false);
  const viewTrackedRef = useRef(false);

  const requiresAuthorizedPlayback = useMemo(
    () =>
      Boolean(
        video?.playbackPolicy === "signed" ||
          video?.visibility === "ppv" ||
          isPastShow(video),
      ),
    [video],
  );

  useEffect(() => {
    setHeartCount(video?.heartCount || 0);
    viewTrackedRef.current = false;
  }, [video?._id, video?.heartCount]);

  useEffect(() => {
    let cancelled = false;

    const resolvePlaybackUrl = async () => {
      if (!video) {
        setPlaybackUrl(null);
        return;
      }

      if (!requiresAuthorizedPlayback) {
        setPlaybackUrl(getPublicPlaybackUrl(video));
        setPlaybackError(null);
        return;
      }

      if (!sessionId) {
        setPlaybackUrl(null);
        setPlaybackError("Playback is unavailable until you sign in.");
        return;
      }

      setIsLoadingPlayback(true);
      setPlaybackError(null);

      try {
        const response = await authorizedWebFetch({
          sessionId,
          path: "/api/playback/signed-url",
          init: {
            method: "POST",
            body: JSON.stringify({ videoId: video._id }),
          },
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data?.url) {
          throw new Error(data?.error || "Failed to load playback URL");
        }

        if (!cancelled) {
          setPlaybackUrl(data.url);
        }
      } catch (error) {
        if (!cancelled) {
          setPlaybackUrl(null);
          setPlaybackError(error?.message || "Playback URL unavailable");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPlayback(false);
        }
      }
    };

    resolvePlaybackUrl();

    return () => {
      cancelled = true;
    };
  }, [requiresAuthorizedPlayback, sessionId, video]);

  const videoSource = playbackUrl
    ? {
        uri: playbackUrl,
        contentType: "hls",
      }
    : null;

  const player = useVideoPlayer(videoSource, (instance) => {
    instance.loop = true;
    instance.staysActiveInBackground = true;
    instance.showNowPlayingNotification = true;
    instance.audioMixingMode = "doNotMix";
    instance.volume = 1.0;
    instance.play();
  });

  useEffect(() => {
    if (!player) {
      return;
    }

    player.muted = isMuted;
  }, [isMuted, player]);

  useEffect(() => {
    if (!player) {
      return;
    }

    const intervalId = setInterval(() => {
      if (typeof player.currentTime === "number") {
        setCurrentTime(player.currentTime);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [player]);

  useEffect(() => {
    if (!video?._id || !playbackUrl || viewTrackedRef.current) {
      return;
    }

    viewTrackedRef.current = true;
    incrementViewCount({ videoId: video._id }).catch((error) => {
      console.error("[VodPlaybackCard] incrementViewCount failed:", error);
    });
  }, [incrementViewCount, playbackUrl, video?._id]);

  const handleHeart = useCallback(async () => {
    if (!video?._id) {
      return;
    }

    setIsHeartAnimating(true);
    setHeartCount((current) => current + 1);

    try {
      await incrementHeartCount({ videoId: video._id });
    } catch (error) {
      setHeartCount((current) => Math.max(0, current - 1));
      console.error("[VodPlaybackCard] incrementHeartCount failed:", error);
    } finally {
      setTimeout(() => setIsHeartAnimating(false), 250);
    }
  }, [incrementHeartCount, video?._id]);

  const renderVideoSurface = (heightStyle) => {
    if (videoSource) {
      return (
        <VideoView
          player={player}
          style={heightStyle}
          contentFit="contain"
          nativeControls={false}
        />
      );
    }

    return (
      <View
        style={{
          ...heightStyle,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#0a0a0a",
        }}
      >
        {isLoadingPlayback ? (
          <>
            <ActivityIndicator size="large" color="#9ACD32" />
            <Text style={{ color: "#666", marginTop: 12, fontSize: 13 }}>
              Loading video...
            </Text>
          </>
        ) : (
          <>
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700", textAlign: "center" }}>
              Playback unavailable
            </Text>
            {playbackError ? (
              <Text style={{ color: "#666", marginTop: 8, fontSize: 13, textAlign: "center" }}>
                {playbackError}
              </Text>
            ) : null}
          </>
        )}
      </View>
    );
  };

  const progressPercent = video?.duration
    ? Math.max(0, Math.min(100, (currentTime / video.duration) * 100))
    : 0;

  return (
    <>
      <View
        style={{
          marginHorizontal: 20,
          marginBottom: 24,
          backgroundColor: "#1a1a1a",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        <Pressable
          onPress={() => {
            if (videoSource) {
              setIsFullscreen(true);
            }
          }}
          style={{
            position: "relative",
            width: "100%",
            height: 240,
            backgroundColor: "#000",
          }}
        >
          {renderVideoSurface({ width: "100%", height: "100%" })}

          {videoSource ? (
            <>
              <View style={{ position: "absolute", top: 12, right: 12 }}>
                <TouchableOpacity
                  onPress={() => setIsFullscreen(true)}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: "rgba(39,39,42,0.85)",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Maximize2 size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={{ position: "absolute", bottom: 12, right: 12 }}>
                <TouchableOpacity
                  onPress={handleHeart}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 12,
                    backgroundColor: "#DC2626",
                    justifyContent: "center",
                    alignItems: "center",
                    transform: [{ scale: isHeartAnimating ? 1.08 : 1 }],
                  }}
                >
                  <Heart size={20} color="#fff" fill="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12, marginTop: 2 }}>
                    {heartCount}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
        </Pressable>

        <View style={{ paddingHorizontal: 20, paddingVertical: 16 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
              {formatDuration(currentTime)}
            </Text>
            <Text style={{ color: "#666", fontSize: 14 }}>
              {formatDuration(video?.duration || 0)}
            </Text>
          </View>

          <View
            style={{
              width: "100%",
              height: 4,
              backgroundColor: "#333",
              borderRadius: 2,
              marginTop: 12,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${progressPercent}%`,
                height: "100%",
                backgroundColor: "#9ACD32",
              }}
            />
          </View>
        </View>
      </View>

      <Modal
        visible={isFullscreen}
        animationType="fade"
        onRequestClose={() => setIsFullscreen(false)}
      >
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <View
            style={{
              position: "absolute",
              top: insets.top + 12,
              left: insets.left + 16,
              right: insets.right + 16,
              zIndex: 2,
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                onPress={() => setIsMuted((value) => !value)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: isMuted ? "#DC2626" : "rgba(0,0,0,0.6)",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {isMuted ? <VolumeX size={22} color="#fff" /> : <Volume2 size={22} color="#fff" />}
              </TouchableOpacity>

              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: "rgba(0,0,0,0.6)",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <VideoAirPlayButton
                  tint="white"
                  activeTint="#9ACD32"
                  style={{ width: 30, height: 30 }}
                />
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setIsFullscreen(false)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: "rgba(0,0,0,0.6)",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <X size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            {renderVideoSurface({ width: "100%", height: "100%" })}
          </View>
        </View>
      </Modal>
    </>
  );
}
