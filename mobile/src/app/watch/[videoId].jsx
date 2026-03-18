import { useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Modal,
  Dimensions,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer, VideoView, VideoAirPlayButton } from "expo-video";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronLeft,
  Lock,
  Zap,
  ExternalLink,
  Heart,
  Maximize2,
  Clock,
  Volume2,
  VolumeX,
  X,
  Play,
  Pause,
} from "lucide-react-native";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import * as ScreenOrientation from "expo-screen-orientation";

import { api } from "convex/_generated/api";
import { useFAPIAuth } from "@/lib/fapi-auth";
import { authorizedWebFetch, getWebUrl } from "@/lib/web-api";
import ClipShareButton from "@/components/ClipShareButton";
import { ActivePlayerContext } from "../_layout";

const parseJsonResponse = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
};

function formatViewCount(count) {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count ?? 0);
}

export default function WatchScreen() {
  const { videoId } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isSignedIn, userId, sessionId } = useFAPIAuth();
  const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
  const { setActivePlayer } = useContext(ActivePlayerContext);

  // Claim audio on mount, release back to home on unmount
  useEffect(() => {
    setActivePlayer("watch");
    return () => setActivePlayer("home");
  }, [setActivePlayer]);

  const [playbackUrl, setPlaybackUrl] = useState(null);
  const [urlError, setUrlError] = useState(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState(null);
  const [showWebFallback, setShowWebFallback] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isHeartAnimating, setIsHeartAnimating] = useState(false);
  const [videoHeartVisible, setVideoHeartVisible] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const viewCountedRef = useRef(false);
  const videoTapRef = useRef(0);
  const videoViewRef = useRef(null);
  const scrubberRef = useRef(null);

  const { width: screenWidth } = useWindowDimensions();
  const videoHeight = Math.round(screenWidth * 9 / 16);

  // Landscape detection for fullscreen modal
  const { width: winW, height: winH } = useWindowDimensions();
  const isLandscape = isFullscreen && winW > winH;

  const video = useQuery(api.videos.getVideo, videoId ? { videoId } : "skip");

  const hasEntitlement = useQuery(
    api.entitlements.hasBundledEntitlement,
    isConvexAuthenticated && userId && video?.visibility === "ppv"
      ? { userId, videoId }
      : "skip",
  );

  const isAdmin = useQuery(
    api.adminSettings.checkIsAdmin,
    isConvexAuthenticated ? {} : "skip",
  ) ?? false;

  const incrementViewCount = useMutation(api.videos.incrementViewCount);
  const incrementHeart = useMutation(api.videos.incrementHeartCount);

  const isPPV = video?.visibility === "ppv";
  const hasAccess = !isPPV || hasEntitlement || isAdmin;
  const videoDuration = video?.duration || 0;
  const heartCount = video?.heartCount || 0;

  // For public/non-signed videos, resolve URL directly (no async needed)
  const needsSignedUrl = video && hasAccess && (video.playbackPolicy === "signed" || video.visibility === "ppv");
  const directUrl = video && hasAccess && !needsSignedUrl
    ? (video.playbackUrl || (video.playbackId ? `https://stream.mux.com/${video.playbackId}.m3u8` : null))
    : null;

  // Only use effect for signed/PPV URL resolution
  useEffect(() => {
    if (!needsSignedUrl || playbackUrl) return;
    if (!sessionId) return;

    setIsLoadingUrl(true);
    setUrlError(null);

    (async () => {
      try {
        const resp = await authorizedWebFetch({
          sessionId,
          path: "/api/playback/signed-url",
          init: {
            method: "POST",
            body: JSON.stringify({ videoId }),
          },
        });
        const data = await parseJsonResponse(resp);
        if (!resp.ok) throw new Error(data?.error || "Failed to get playback URL");
        setPlaybackUrl(data.url);
      } catch (e) {
        console.error("[Watch] signed URL error:", e);
        setUrlError(e.message);
      } finally {
        setIsLoadingUrl(false);
      }
    })();
  }, [needsSignedUrl, sessionId, playbackUrl, videoId]);

  // Effective playback URL: direct for public, state for signed
  const resolvedPlaybackUrl = directUrl || playbackUrl;

  // Increment view count once
  useEffect(() => {
    if (video && hasAccess && resolvedPlaybackUrl && !viewCountedRef.current) {
      viewCountedRef.current = true;
      incrementViewCount({ videoId }).catch(() => {});
    }
  }, [video, hasAccess, resolvedPlaybackUrl, videoId, incrementViewCount]);

  // Video player
  const videoSource = resolvedPlaybackUrl ? { uri: resolvedPlaybackUrl, contentType: "hls" } : null;

  const player = useVideoPlayer(videoSource, (p) => {
    p.loop = false;
    p.staysActiveInBackground = true;
    p.showNowPlayingNotification = true;
    p.audioMixingMode = "doNotMix";
    p.volume = 1.0;
    p.play();
  });

  // Sync muted state
  useEffect(() => {
    if (!player) return;
    player.muted = isMuted;
  }, [player, isMuted]);

  // Update current time periodically
  useEffect(() => {
    if (!player) return;
    const interval = setInterval(() => {
      if (player.currentTime !== undefined) {
        setCurrentTime(player.currentTime);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [player]);

  // Unlock orientation when fullscreen
  useEffect(() => {
    if (isFullscreen) {
      ScreenOrientation.unlockAsync();
      return () => {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      };
    } else {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    }
  }, [isFullscreen]);

  // Heart
  const handleHeart = useCallback(async () => {
    if (!videoId) return;
    setIsHeartAnimating(true);
    setTimeout(() => setIsHeartAnimating(false), 300);
    try {
      await incrementHeart({ videoId });
    } catch (error) {
      console.error("Heart error:", error);
    }
  }, [videoId, incrementHeart]);

  // Double tap for heart
  const handleVideoDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - videoTapRef.current < 300) {
      videoTapRef.current = 0;
      setVideoHeartVisible(true);
      setTimeout(() => setVideoHeartVisible(false), 600);
      handleHeart();
    } else {
      videoTapRef.current = now;
    }
  }, [handleHeart]);

  // Play/pause toggle
  const togglePlayPause = useCallback(() => {
    if (!player) return;
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.play();
      setIsPlaying(true);
    }
  }, [player, isPlaying]);

  // Scrubber seek
  const handleScrubberPress = useCallback((event) => {
    if (!player || !videoDuration) return;
    scrubberRef.current?.measure?.((x, y, width) => {
      if (width > 0) {
        const ratio = Math.max(0, Math.min(1, event.nativeEvent.locationX / width));
        const seekTo = ratio * videoDuration;
        player.currentTime = seekTo;
        setCurrentTime(seekTo);
      }
    });
  }, [player, videoDuration]);

  // PPV purchase handler
  const handlePurchase = useCallback(async () => {
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

    setIsPurchasing(true);
    setPurchaseError(null);
    setShowWebFallback(false);

    try {
      const redirectUrl = AuthSession.makeRedirectUri({ path: "ppv-callback" });

      const response = await Promise.race([
        authorizedWebFetch({
          sessionId,
          path: "/api/ppv/create-session",
          init: {
            method: "POST",
            body: JSON.stringify({
              videoId,
              successUrl: redirectUrl,
              cancelUrl: redirectUrl,
            }),
          },
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Request timed out")), 15000),
        ),
      ]);

      const data = await parseJsonResponse(response);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setShowWebFallback(true);
        }
        throw new Error(data?.error || "Failed to create checkout session");
      }

      if (!data?.url) throw new Error("Missing checkout URL");

      await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
    } catch (error) {
      console.error("[Watch] purchase error:", error);
      setPurchaseError(error instanceof Error ? error.message : "Purchase failed");
      if (
        error?.status === 401 ||
        error?.status === 403 ||
        error?.code === "MISSING_SESSION" ||
        error?.code === "TOKEN_UNAVAILABLE"
      ) {
        setShowWebFallback(true);
      }
    } finally {
      setIsPurchasing(false);
    }
  }, [isSignedIn, sessionId, videoId, router]);

  const handleRetryUrl = useCallback(() => {
    setPlaybackUrl(null);
    setUrlError(null);
  }, []);

  // --- Loading state ---
  if (video === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#9ACD32" />
      </View>
    );
  }

  // --- Not found ---
  if (video === null) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center", padding: 24 }}>
        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 16 }}>
          Video not found
        </Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: "#9ACD32", fontSize: 16, fontWeight: "600" }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- PPV Gate ---
  if (isPPV && !hasAccess) {
    const priceDisplay = video.price ? `$${(video.price / 100).toFixed(2)}` : "Premium";

    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            position: "absolute",
            top: insets.top + 8,
            left: 16,
            zIndex: 10,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.6)",
            borderRadius: 20,
            paddingVertical: 6,
            paddingHorizontal: 12,
          }}
        >
          <ChevronLeft size={20} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600", marginLeft: 4 }}>Back</Text>
        </TouchableOpacity>

        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 }}>
          <Lock size={40} color="#666" style={{ marginBottom: 16 }} />

          <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700", textAlign: "center", marginBottom: 8 }}>
            {video.title}
          </Text>

          <Text style={{ color: "#666", fontSize: 12, letterSpacing: 1, textTransform: "uppercase", marginBottom: 20 }}>
            Exclusive Content
          </Text>

          <Text style={{ fontSize: 42, fontWeight: "900", color: "#9ACD32", marginBottom: 8, letterSpacing: -1 }}>
            {priceDisplay}
          </Text>

          <Text style={{ color: "#999", fontSize: 13, marginBottom: 28 }}>
            One-time purchase. Watch anytime.
          </Text>

          {isSignedIn ? (
            <TouchableOpacity
              onPress={handlePurchase}
              disabled={isPurchasing}
              style={{
                backgroundColor: "#9ACD32",
                borderRadius: 12,
                paddingVertical: 14,
                paddingHorizontal: 32,
                alignItems: "center",
                width: "100%",
                opacity: isPurchasing ? 0.7 : 1,
              }}
            >
              {isPurchasing ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Zap size={18} color="#000" />
                  <Text style={{ color: "#000", fontWeight: "800", fontSize: 16, marginLeft: 8 }}>
                    Unlock This Show
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => router.push("/sign-in")}
              style={{
                backgroundColor: "#1a1a1a",
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#333",
                paddingVertical: 14,
                paddingHorizontal: 32,
                alignItems: "center",
                width: "100%",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                Sign In to Purchase
              </Text>
            </TouchableOpacity>
          )}

          {showWebFallback ? (
            <TouchableOpacity
              onPress={() => WebBrowser.openBrowserAsync(getWebUrl("/"))}
              style={{
                marginTop: 12,
                backgroundColor: "#111827",
                borderRadius: 10,
                paddingVertical: 10,
                alignItems: "center",
                borderColor: "#374151",
                borderWidth: 1,
                width: "100%",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <ExternalLink size={14} color="#9ACD32" />
                <Text style={{ color: "#9ACD32", marginLeft: 6, fontWeight: "700" }}>Open on web</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {purchaseError ? (
            <Text style={{ color: "#f87171", marginTop: 12, fontSize: 12, textAlign: "center" }}>
              {purchaseError}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  // --- Loading playback URL ---
  if (isLoadingUrl || (!resolvedPlaybackUrl && !urlError)) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#9ACD32" />
        <Text style={{ color: "#666", marginTop: 12, fontSize: 13 }}>Loading video...</Text>
      </View>
    );
  }

  // --- URL error ---
  if (urlError) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center", padding: 24 }}>
        <Text style={{ color: "#f87171", fontSize: 15, textAlign: "center", marginBottom: 16 }}>
          {urlError}
        </Text>
        <TouchableOpacity
          onPress={handleRetryUrl}
          style={{
            backgroundColor: "#1a1a1a",
            borderRadius: 10,
            paddingVertical: 10,
            paddingHorizontal: 24,
            borderWidth: 1,
            borderColor: "#333",
          }}
        >
          <Text style={{ color: "#9ACD32", fontWeight: "600" }}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={{ color: "#888", fontSize: 14 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- Video player ---
  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header bar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: insets.top + 8,
            paddingHorizontal: 20,
            paddingBottom: 12,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ flexDirection: "row", alignItems: "center" }}
          >
            <ChevronLeft size={22} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600", marginLeft: 4 }}>Back</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <ClipShareButton
              videoId={videoId}
              currentTime={currentTime}
              streamTitle={video.title}
              sessionId={sessionId}
              isLive={false}
              provider={video.provider}
            />

            <TouchableOpacity
              onPress={() => setIsMuted((m) => !m)}
              activeOpacity={0.7}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: isMuted ? "#DC2626" : "rgba(39,39,42,0.85)",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {isMuted ? <VolumeX size={20} color="#fff" /> : <Volume2 size={20} color="#fff" />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Video card */}
        <View
          style={{
            marginHorizontal: 20,
            backgroundColor: "#1a1a1a",
            borderRadius: 16,
            overflow: "hidden",
            marginBottom: 24,
          }}
        >
          {/* Title */}
          <View style={{ padding: 20 }}>
            <Text
              style={{
                fontSize: 24,
                fontWeight: "700",
                color: "#fff",
                lineHeight: 32,
              }}
            >
              {video.title}
            </Text>
          </View>

          {/* Video Player */}
          <Pressable
            onPress={handleVideoDoubleTap}
            style={{
              position: "relative",
              width: "100%",
              height: videoHeight,
              backgroundColor: "#2a2a2a",
            }}
          >
            {videoSource ? (
              <VideoView
                ref={videoViewRef}
                player={player}
                style={{ width: "100%", height: "100%" }}
                contentFit="contain"
                nativeControls={false}
              />
            ) : (
              <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator size="large" color="#9ACD32" />
              </View>
            )}

            {/* Double-tap heart animation */}
            {videoHeartVisible && (
              <View
                style={{
                  position: "absolute",
                  top: 0, left: 0, right: 0, bottom: 0,
                  justifyContent: "center",
                  alignItems: "center",
                  pointerEvents: "none",
                }}
              >
                <Heart size={72} color="#DC2626" fill="#DC2626" style={{ opacity: 0.85 }} />
              </View>
            )}

            {/* Fullscreen button */}
            <View style={{ position: "absolute", top: 12, right: 12 }}>
              <TouchableOpacity
                onPress={() => setIsFullscreen(true)}
                activeOpacity={0.7}
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

            {/* Like Button */}
            <View style={{ position: "absolute", bottom: 12, right: 12 }}>
              <TouchableOpacity
                onPress={handleHeart}
                activeOpacity={0.7}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 12,
                  backgroundColor: "#DC2626",
                  justifyContent: "center",
                  alignItems: "center",
                  transform: [{ scale: isHeartAnimating ? 1.1 : 1 }],
                }}
              >
                <Heart size={20} color="#fff" fill="#fff" />
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12, marginTop: 2 }}>
                  {heartCount}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>

          {/* Scrubber + time display */}
          <View style={{ padding: 20 }}>
            {/* Play/pause + time */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <TouchableOpacity onPress={togglePlayPause} activeOpacity={0.7}>
                {isPlaying ? (
                  <Pause size={22} color="#9ACD32" fill="#9ACD32" />
                ) : (
                  <Play size={22} color="#9ACD32" fill="#9ACD32" />
                )}
              </TouchableOpacity>
              <Clock size={18} color="#999" />
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
                {formatDuration(currentTime)}
              </Text>
              <Text style={{ color: "#666", fontSize: 16 }}>
                / {formatDuration(videoDuration)}
              </Text>
            </View>

            {/* Scrubber bar */}
            <Pressable
              ref={scrubberRef}
              onPress={handleScrubberPress}
              style={{
                width: "100%",
                height: 24,
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: "100%",
                  height: 4,
                  backgroundColor: "#333",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    width: `${videoDuration > 0 ? (currentTime / videoDuration) * 100 : 0}%`,
                    height: "100%",
                    backgroundColor: "#9ACD32",
                  }}
                />
              </View>
              {/* Scrubber thumb */}
              {videoDuration > 0 && (
                <View
                  style={{
                    position: "absolute",
                    left: `${(currentTime / videoDuration) * 100}%`,
                    marginLeft: -6,
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: "#9ACD32",
                  }}
                />
              )}
            </Pressable>
          </View>
        </View>

        {/* Video info card */}
        <View
          style={{
            marginHorizontal: 20,
            backgroundColor: "#1a1a1a",
            borderRadius: 16,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "600", color: "#fff", marginBottom: 8 }}>
            {video.title.length > 45 ? `${video.title.substring(0, 45)}...` : video.title}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: "#999", fontSize: 14 }}>
              {formatViewCount(video.viewCount)} views
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Clock size={16} color="#999" />
              <Text style={{ color: "#999", fontSize: 14 }}>{formatDuration(videoDuration)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Fullscreen Video Modal */}
      <Modal
        visible={isFullscreen}
        animationType="fade"
        supportedOrientations={["portrait", "landscape-left", "landscape-right"]}
        onRequestClose={() => setIsFullscreen(false)}
      >
        {isLandscape ? (
          /* Landscape: flex row — button column + video area */
          <View style={{ flex: 1, flexDirection: "row", backgroundColor: "#000" }}>
            <View
              style={{
                paddingLeft: insets.top,
                justifyContent: "center",
                alignItems: "center",
                gap: 12,
              }}
            >
              <TouchableOpacity
                onPress={() => setIsMuted((m) => !m)}
                activeOpacity={0.7}
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
                <VideoAirPlayButton tint="white" activeTint="#9ACD32" style={{ width: 30, height: 30 }} />
              </View>
              <TouchableOpacity
                onPress={() => setIsFullscreen(false)}
                activeOpacity={0.7}
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
            <Pressable onPress={handleVideoDoubleTap} style={{ flex: 1 }}>
              <VideoView
                player={player}
                style={{ flex: 1 }}
                contentFit="contain"
                nativeControls={false}
              />
              {videoHeartVisible && (
                <View
                  style={{
                    position: "absolute",
                    top: 0, left: 0, right: 0, bottom: 0,
                    justifyContent: "center",
                    alignItems: "center",
                    pointerEvents: "none",
                  }}
                >
                  <Heart size={96} color="#DC2626" fill="#DC2626" style={{ opacity: 0.85 }} />
                </View>
              )}
            </Pressable>
          </View>
        ) : (
          /* Portrait fullscreen */
          <Pressable
            onPress={handleVideoDoubleTap}
            style={{ flex: 1, backgroundColor: "#000" }}
          >
            <VideoView
              player={player}
              style={{ flex: 1 }}
              contentFit="contain"
              nativeControls={false}
            />
            {videoHeartVisible && (
              <View
                style={{
                  position: "absolute",
                  top: 0, left: 0, right: 0, bottom: 0,
                  justifyContent: "center",
                  alignItems: "center",
                  pointerEvents: "none",
                }}
              >
                <Heart size={96} color="#DC2626" fill="#DC2626" style={{ opacity: 0.85 }} />
              </View>
            )}
            <TouchableOpacity
              onPress={() => setIsFullscreen(false)}
              activeOpacity={0.7}
              style={{
                position: "absolute",
                top: insets.top + 12,
                right: insets.right + 16,
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
            <TouchableOpacity
              onPress={() => setIsMuted((m) => !m)}
              activeOpacity={0.7}
              style={{
                position: "absolute",
                top: insets.top + 12,
                left: insets.left + 16,
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
                position: "absolute",
                top: insets.top + 12,
                left: insets.left + 72,
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: "rgba(0,0,0,0.6)",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <VideoAirPlayButton tint="white" activeTint="#9ACD32" style={{ width: 30, height: 30 }} />
            </View>
          </Pressable>
        )}
      </Modal>
    </View>
  );
}
