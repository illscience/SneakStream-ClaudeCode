import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Modal,
  Dimensions,
  TextInput,
  ActivityIndicator,
  AppState,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Heart,
  Maximize2,
  Clock,
  Play,
  MessageCircle,
  ImageIcon,
  Smile,
  Send,
  LogIn,
  Volume2,
  VolumeX,
  Inbox,
  MessageSquare,
  UserPlus,
  Reply,
  Radio,
  X,
} from "lucide-react-native";
import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, usePaginatedQuery, useConvexAuth } from "convex/react";
import { api } from "convex/_generated/api";
import { useVideoPlayer, VideoView } from "expo-video";
import KeyboardAvoidingAnimatedView from "@/components/KeyboardAvoidingAnimatedView";
import { useRouter } from "expo-router";
import { useFAPIAuth } from "@/lib/fapi-auth";
import AuctionPanel from "@/components/AuctionPanel";
import * as ImagePicker from "expo-image-picker";

const EMOTE_TOKEN_PATTERN = /^:emote:([^\s]+)$/;
const CRATE_PURCHASE_PATTERN = /^:crate_purchase:(.+)$/;
const AUCTION_PATTERN = /^:auction:(.+)$/;
const EMOTE_ID_PATTERN = /^[A-Za-z0-9._-]+$/;
const DEFAULT_EMOTE_BASE_URL = "https://www.dreaminaudio.xyz";
const EMOTE_IDS = Array.from({ length: 65 }, (_, index) => `image${index}.png`);
const MAX_CHAT_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;

const emoteBaseUrl = (
  process.env.EXPO_PUBLIC_EMOTE_BASE_URL ||
  process.env.EXPO_PUBLIC_APP_URL ||
  process.env.EXPO_PUBLIC_BASE_URL ||
  DEFAULT_EMOTE_BASE_URL
).replace(/\/+$/, "");

const getEmoteUriFromBody = (body) => {
  if (typeof body !== "string") return null;
  const match = body.trim().match(EMOTE_TOKEN_PATTERN);
  if (!match) return null;

  const emoteId = match[1];
  if (!EMOTE_ID_PATTERN.test(emoteId)) return null;

  const baseWithEmotesPath = /\/emotes$/i.test(emoteBaseUrl)
    ? emoteBaseUrl
    : `${emoteBaseUrl}/emotes`;

  return `${baseWithEmotesPath}/${encodeURIComponent(emoteId)}`;
};

const parseCratePurchaseToken = (body) => {
  if (typeof body !== "string") return null;
  const match = body.trim().match(CRATE_PURCHASE_PATTERN);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1]);
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.amount !== "number") return null;
    return {
      amount: parsed.amount,
    };
  } catch {
    return null;
  }
};

const parseAuctionToken = (body) => {
  if (typeof body !== "string") return null;
  const match = body.trim().match(AUCTION_PATTERN);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1]);
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.amount !== "number") return null;
    if (typeof parsed.type !== "string") return null;
    return {
      type: parsed.type,
      amount: parsed.amount,
    };
  } catch {
    return null;
  }
};

const inferImageMimeType = (asset, fallbackMimeType) => {
  if (typeof asset?.mimeType === "string" && asset.mimeType) {
    return asset.mimeType;
  }

  const uriWithoutQuery = typeof asset?.uri === "string" ? asset.uri.toLowerCase().split("?")[0] : "";
  if (uriWithoutQuery.endsWith(".gif")) return "image/gif";
  if (uriWithoutQuery.endsWith(".png")) return "image/png";
  if (uriWithoutQuery.endsWith(".webp")) return "image/webp";
  if (uriWithoutQuery.endsWith(".heic") || uriWithoutQuery.endsWith(".heif")) return "image/heic";
  if (uriWithoutQuery.endsWith(".jpg") || uriWithoutQuery.endsWith(".jpeg")) return "image/jpeg";
  return fallbackMimeType || "image/jpeg";
};

export default function Index() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isSignedIn, user } = useFAPIAuth();
  const { isAuthenticated: isConvexAuthenticated, isLoading: isConvexAuthLoading } = useConvexAuth();
  const [chatMessage, setChatMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isEmotePickerOpen, setIsEmotePickerOpen] = useState(false);
  const [isHeartAnimating, setIsHeartAnimating] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [loveAnimatingId, setLoveAnimatingId] = useState(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const lastTapRef = useRef({ messageId: null, time: 0 });
  const [currentTime, setCurrentTime] = useState(0);
  const [hasSyncedPlayback, setHasSyncedPlayback] = useState(false);
  const scrollViewRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(0);
  const [scrollViewHeight, setScrollViewHeight] = useState(0);

  const { width } = Dimensions.get("window");
  const videoHeight = width * (9 / 16);

  // Convex queries
  const playbackState = useQuery(api.playbackState.getPlaybackState);
  const defaultVideo = useQuery(api.videos.getDefaultVideo);
  const publicVideos = useQuery(api.videos.getPublicVideos, { limit: 1 });
  const activeStream = useQuery(api.livestream.getActiveStream);
  const unreadCount = useQuery(
    api.notifications.getUnreadCount,
    isConvexAuthenticated ? {} : "skip"
  );
  const notifications = useQuery(
    api.notifications.getNotifications,
    isConvexAuthenticated && isNotificationsOpen ? {} : "skip"
  );

  // Paginated messages - loads 15 at a time, newest first for display
  const {
    results: messages,
    status: messagesStatus,
    loadMore,
  } = usePaginatedQuery(api.chat.getMessagesPage, {}, { initialNumItems: 15 });

  const isLoadingMore = messagesStatus === "LoadingMore";
  const canLoadMore = messagesStatus === "CanLoadMore";
  const canSendChat = isSignedIn && isConvexAuthenticated;

  // Auto-load more messages when scrolling near bottom
  const handleScroll = useCallback((event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 100; // pixels from bottom to trigger load
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;

    if (isCloseToBottom && canLoadMore && !isLoadingMore) {
      loadMore(15);
    }
  }, [canLoadMore, isLoadingMore, loadMore]);

  const isLive = !!activeStream?.playbackUrl;

  // Prefer live stream when active, otherwise fall back to recorded video
  const currentVideo = activeStream?.playbackUrl
    ? activeStream
    : playbackState?.video || defaultVideo || publicVideos?.[0];

  // Convex mutations
  const sendMessage = useMutation(api.chat.sendMessage);
  const generateUploadUrl = useMutation(api.chat.generateUploadUrl);
  const incrementHeart = useMutation(api.videos.incrementHeartCount);
  const upsertUser = useMutation(api.users.upsertUser);
  const loveMessage = useMutation(api.chat.loveMessage);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);

  // Sync FAPI user profile to Convex (same as web app does on login)
  const userSyncedRef = useRef(false);
  useEffect(() => {
    if (!isSignedIn || !isConvexAuthenticated || !user || userSyncedRef.current) return;
    userSyncedRef.current = true;
    const alias = user.username || [user.first_name, user.last_name].filter(Boolean).join(" ") || "User";
    const email = user.email_addresses?.[0]?.email_address;
    upsertUser({ alias, email, imageUrl: user.image_url })
      .catch((e) => console.error("[UserSync] upsertUser failed:", e));
  }, [isSignedIn, isConvexAuthenticated, user, upsertUser]);

  // Video player setup - use playbackUrl from the video
  // For iOS HLS playback, we need to specify contentType
  const videoSource = currentVideo?.playbackUrl
    ? { uri: currentVideo.playbackUrl, contentType: 'hls' }
    : null;


  const player = useVideoPlayer(videoSource, (player) => {
    player.loop = !isLive;
    player.staysActiveInBackground = true;
    player.showNowPlayingNotification = true;
    player.audioMixingMode = "doNotMix";
    player.volume = 1.0;
    player.play();
  });

  // Sync muted state to player
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
    }, 1000);
    return () => clearInterval(interval);
  }, [player]);

  // Get the global startTime from playbackState (when the video started playing for everyone)
  const globalStartTime = playbackState?.startTime || defaultVideo?.startTime;
  const videoDurationForSync = currentVideo?.duration;

  // Sync video position with global playback time
  // This ensures all viewers see the same point in the video
  // Skip sync for live streams — they play in real-time
  useEffect(() => {
    if (isLive || !player || !globalStartTime || !videoDurationForSync || hasSyncedPlayback) {
      return;
    }

    const syncToGlobalTime = () => {
      const now = Date.now();
      const elapsedSeconds = (now - globalStartTime) / 1000;
      const duration = videoDurationForSync;

      // Calculate position with looping (same as web)
      const syncedPosition = duration > 0 ? elapsedSeconds % duration : elapsedSeconds;

      if (syncedPosition >= 0 && syncedPosition < duration) {
        player.currentTime = syncedPosition;
        setHasSyncedPlayback(true);
      }
    };

    // Small delay to ensure player is ready
    const timeoutId = setTimeout(syncToGlobalTime, 500);
    return () => clearTimeout(timeoutId);
  }, [player, globalStartTime, videoDurationForSync, hasSyncedPlayback]);

  // Reset sync flag when video source changes
  useEffect(() => {
    setHasSyncedPlayback(false);
  }, [videoSource?.uri]);

  // Re-sync when app comes back from background
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active" && player) {
        // For live streams, just resume playback — no timeline sync needed
        if (isLive) {
          player.play();
          return;
        }

        if (globalStartTime && videoDurationForSync) {
          // Re-calculate and sync position
          const now = Date.now();
          const elapsedSeconds = (now - globalStartTime) / 1000;
          const syncedPosition = videoDurationForSync > 0
            ? elapsedSeconds % videoDurationForSync
            : elapsedSeconds;

          if (syncedPosition >= 0 && syncedPosition < videoDurationForSync) {
            player.currentTime = syncedPosition;
          }
        }

        // Resume playback
        player.play();
      }
    });

    return () => subscription.remove();
  }, [player, isLive, globalStartTime, videoDurationForSync]);

  const heartVideoId = playbackState?.videoId || defaultVideo?._id || publicVideos?.[0]?._id;
  const handleHeart = useCallback(async () => {
    if (!heartVideoId) return;
    setIsHeartAnimating(true);
    setTimeout(() => setIsHeartAnimating(false), 300);
    try {
      await incrementHeart({ videoId: heartVideoId });
    } catch (error) {
      console.error("Heart error:", error);
    }
  }, [heartVideoId, incrementHeart]);

  const handleMessageTap = useCallback((messageId) => {
    const now = Date.now();
    const last = lastTapRef.current;

    if (last.messageId === messageId && now - last.time < 300) {
      // Double tap detected
      lastTapRef.current = { messageId: null, time: 0 };
      if (!canSendChat) return;

      setLoveAnimatingId(messageId);
      setTimeout(() => setLoveAnimatingId(null), 600);

      loveMessage({ messageId }).catch((error) => {
        console.error("[Chat] loveMessage failed:", error?.message || error);
      });
    } else {
      lastTapRef.current = { messageId, time: now };
    }
  }, [canSendChat, loveMessage]);

  const handleOpenNotifications = useCallback(() => {
    setIsNotificationsOpen(true);
  }, []);

  const handleCloseNotifications = useCallback(() => {
    setIsNotificationsOpen(false);
    markAllAsRead().catch((e) => console.error("[Notifications] markAllAsRead failed:", e));
  }, [markAllAsRead]);

  const handleSendMessage = useCallback(async () => {
    console.log("[Chat] handleSendMessage — isSignedIn:", isSignedIn, "isConvexAuthenticated:", isConvexAuthenticated, "isSending:", isSending, "msg:", chatMessage.trim().substring(0, 20));
    if (!chatMessage.trim() || isSending || !canSendChat) {
      console.log("[Chat] blocked — empty:", !chatMessage.trim(), "sending:", isSending, "convexUnauthed:", !canSendChat);
      return;
    }

    const body = chatMessage.trim();
    setChatMessage("");
    setIsEmotePickerOpen(false);
    setIsSending(true);

    try {
      console.log("[Chat] calling sendMessage mutation with body:", body.substring(0, 30));
      await sendMessage({ body });
      console.log("[Chat] sendMessage SUCCESS");
    } catch (error) {
      console.error("[Chat] sendMessage FAILED:", error?.message || error);
      setChatMessage(body);
    } finally {
      setIsSending(false);
    }
  }, [chatMessage, isSending, isSignedIn, isConvexAuthenticated, canSendChat, sendMessage]);

  const handleToggleEmotePicker = useCallback(() => {
    if (!canSendChat || isSending) return;
    setIsEmotePickerOpen((prev) => !prev);
  }, [canSendChat, isSending]);

  const handleSendEmote = useCallback(async (emoteId) => {
    if (!canSendChat || isSending) return;

    setIsSending(true);
    try {
      await sendMessage({ body: `:emote:${emoteId}` });
      setIsEmotePickerOpen(false);
    } catch (error) {
      console.error("[Chat] failed to send emote:", error?.message || error);
    } finally {
      setIsSending(false);
    }
  }, [canSendChat, isSending, sendMessage]);

  const handlePickPhoto = useCallback(async () => {
    if (!canSendChat || isSending) return;
    setIsEmotePickerOpen(false);

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission required", "Please allow photo library access to send images.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const selectedAsset = result.assets[0];
      if (
        typeof selectedAsset.fileSize === "number" &&
        selectedAsset.fileSize > MAX_CHAT_IMAGE_SIZE_BYTES
      ) {
        Alert.alert("Image too large", "Please choose an image under 8MB.");
        return;
      }

      setIsSending(true);

      const localFileResponse = await fetch(selectedAsset.uri);
      const localFileBlob = await localFileResponse.blob();

      if (localFileBlob.size > MAX_CHAT_IMAGE_SIZE_BYTES) {
        Alert.alert("Image too large", "Please choose an image under 8MB.");
        return;
      }

      const mimeType = inferImageMimeType(selectedAsset, localFileBlob.type);
      const { uploadUrl } = await generateUploadUrl({});
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": mimeType,
        },
        body: localFileBlob,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed with status ${uploadResponse.status}`);
      }

      const uploadPayload = await uploadResponse.json();
      const storageId = uploadPayload?.storageId;
      if (!storageId) {
        throw new Error("Upload response missing storageId");
      }

      const messageText = chatMessage.trim();
      await sendMessage({
        body: messageText || "",
        imageStorageId: storageId,
        imageMimeType: mimeType,
      });
      if (messageText) {
        setChatMessage("");
      }
    } catch (error) {
      console.error("[Chat] failed to upload photo:", error?.message || error);
      Alert.alert("Upload failed", "We could not send that photo. Please try again.");
    } finally {
      setIsSending(false);
    }
  }, [canSendChat, isSending, chatMessage, generateUploadUrl, sendMessage]);

  const videoTitle = currentVideo?.title || "Loading...";
  // Heart count always comes from the video record (not the livestream object)
  const heartVideo = playbackState?.video || defaultVideo || publicVideos?.[0];
  const heartCount = heartVideo?.heartCount || 0;
  const videoDuration = currentVideo?.duration || 0;

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <KeyboardAvoidingAnimatedView
      style={{ flex: 1, backgroundColor: "#000" }}
      behavior="padding"
    >
      <StatusBar style="light" />

      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={400}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            paddingTop: insets.top + 16,
            paddingBottom: 16,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {/* Colorful logo grid */}
            <View style={{ marginRight: 12 }}>
              <View style={{ flexDirection: "row", gap: 4, marginBottom: 4 }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: "#E91E63" }} />
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: "#2196F3" }} />
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: "#00BCD4" }} />
              </View>
              <View style={{ flexDirection: "row", gap: 4, marginBottom: 4 }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: "#4CAF50" }} />
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: "#8BC34A" }} />
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: "#FFC107" }} />
              </View>
              <View style={{ flexDirection: "row", gap: 4 }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: "#FF9800" }} />
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: "#9C27B0" }} />
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: "#673AB7" }} />
              </View>
            </View>

            <Text style={{ fontSize: 28, fontWeight: "700", color: "#fff" }}>
              <Text style={{ color: "#fff" }}>dj</Text>
              <Text style={{ color: "#E91E63" }}>sneak</Text>
            </Text>
          </View>

          {/* Right side: LIVE badge + Mute + Notifications */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {isLive && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "#DC2626",
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 20,
                  gap: 5,
                }}
              >
                <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#fff" }} />
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 11 }}>LIVE</Text>
              </View>
            )}

            <TouchableOpacity
              onPress={() => setIsMuted((m) => !m)}
              activeOpacity={0.7}
              style={{
                height: 40,
                borderRadius: 20,
                backgroundColor: isMuted ? "#DC2626" : "rgba(39,39,42,0.85)",
                justifyContent: "center",
                alignItems: "center",
                flexDirection: "row",
                paddingHorizontal: 12,
                gap: 6,
              }}
            >
              {isMuted ? (
                <>
                  <VolumeX size={20} color="#fff" />
                  <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700", letterSpacing: 0.5 }}>
                    MUTED
                  </Text>
                </>
              ) : (
                <Volume2 size={20} color="#fff" />
              )}
            </TouchableOpacity>

            {isSignedIn && isConvexAuthenticated && (
              <TouchableOpacity
                onPress={handleOpenNotifications}
                activeOpacity={0.7}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: "rgba(39,39,42,0.85)",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Inbox size={20} color="#fff" />
                {typeof unreadCount === "number" && unreadCount > 0 && (
                  <View
                    style={{
                      position: "absolute",
                      top: -2,
                      right: -2,
                      minWidth: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: "#DC2626",
                      justifyContent: "center",
                      alignItems: "center",
                      paddingHorizontal: 4,
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Video Section */}
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
              {videoTitle}
            </Text>
          </View>

          {/* Video Player */}
          <View
            style={{
              position: "relative",
              width: "100%",
              height: videoHeight,
              backgroundColor: "#2a2a2a",
            }}
          >
            {videoSource ? (
              <VideoView
                player={player}
                style={{ width: "100%", height: "100%" }}
                contentFit="contain"
                nativeControls={false}
              />
            ) : (
              <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator size="large" color="#9ACD32" />
                <Text style={{ color: "#666", marginTop: 12 }}>Loading video...</Text>
              </View>
            )}

            {/* Video Overlay Controls */}
            <View
              style={{
                position: "absolute",
                top: 12,
                right: 12,
              }}
            >
              <TouchableOpacity
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
          </View>

          {/* Progress Bar */}
          <View style={{ padding: 20, alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Clock size={20} color="#999" />
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
                {formatDuration(currentTime)}
              </Text>
              <Text style={{ color: "#666", fontSize: 16 }}>
                / {formatDuration(videoDuration)}
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
                  width: `${videoDuration > 0 ? (currentTime / videoDuration) * 100 : 0}%`,
                  height: "100%",
                  backgroundColor: "#9ACD32",
                }}
              />
            </View>
          </View>
        </View>

        {/* Now Playing Section */}
        <View
          style={{
            marginHorizontal: 20,
            backgroundColor: "#1a1a1a",
            borderRadius: 16,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#9ACD32", marginRight: 8 }} />
            <Text style={{ color: "#9ACD32", fontSize: 14, fontWeight: "700", letterSpacing: 1 }}>
              NOW PLAYING
            </Text>
          </View>

          <Text style={{ fontSize: 18, fontWeight: "600", color: "#fff", marginBottom: 8 }}>
            {videoTitle.length > 45 ? `${videoTitle.substring(0, 45)}...` : videoTitle}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: "#999", fontSize: 14 }}>
              {currentVideo?.source || "DJ Sneak"}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Clock size={16} color="#999" />
              <Text style={{ color: "#999", fontSize: 14 }}>{formatDuration(videoDuration)}</Text>
            </View>
          </View>
        </View>

        {/* Live Chat Section */}
        <View
          style={{
            marginHorizontal: 20,
            backgroundColor: "#1a1a1a",
            borderRadius: 16,
            padding: 20,
            marginBottom: 24,
          }}
        >
          {/* Chat Header */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
            <MessageCircle size={28} color="#9ACD32" />
            <Text style={{ fontSize: 28, fontWeight: "700", color: "#9ACD32", marginLeft: 12 }}>
              Live Chat
            </Text>
          </View>

          {/* User Avatar / Sign In */}
          {isSignedIn ? (
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ color: "#999", fontSize: 14, marginRight: 12 }}>Your avatar:</Text>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: "#E91E63",
                  marginRight: 12,
                  overflow: "hidden",
                }}
              >
                {user?.image_url ? (
                  <Image source={{ uri: user.image_url }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                ) : (
                  <View style={{ width: "100%", height: "100%", justifyContent: "center", alignItems: "center" }}>
                    <Text style={{ color: "#fff", fontWeight: "700" }}>
                      {(user?.first_name || user?.username || "U")[0].toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={{ color: "#9ACD32", fontSize: 16, fontWeight: "600" }}>
                {user?.first_name || user?.username || "You"}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#9ACD32",
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderRadius: 12,
                marginBottom: 16,
                alignSelf: "flex-start",
              }}
              onPress={() => router.push("/sign-in")}
            >
              <LogIn size={20} color="#000" />
              <Text style={{ color: "#000", fontWeight: "700", marginLeft: 8 }}>Sign in to chat</Text>
            </TouchableOpacity>
          )}

          {isSignedIn ? (
            <Text style={{ color: "#666", fontSize: 12, marginBottom: 12 }}>
              {isConvexAuthLoading
                ? "Connecting chat authentication..."
                : isConvexAuthenticated
                  ? "Chat authentication connected"
                  : "Chat authentication unavailable"}
            </Text>
          ) : null}

          {activeStream?._id ? (
            <AuctionPanel
              livestreamId={activeStream._id}
              streamStartedAt={activeStream?.startedAt}
              onRequireSignIn={() => router.push("/sign-in")}
            />
          ) : null}

          {/* Chat Input */}
          {isSignedIn ? (
            canSendChat ? (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: isEmotePickerOpen ? 12 : 24 }}>
                  <TouchableOpacity
                    onPress={handlePickPhoto}
                    disabled={isSending || !canSendChat}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: "#2a2a2a",
                      justifyContent: "center",
                      alignItems: "center",
                      marginRight: 8,
                      opacity: isSending || !canSendChat ? 0.6 : 1,
                    }}
                  >
                    <ImageIcon size={20} color="#999" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleToggleEmotePicker}
                    disabled={isSending || !canSendChat}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: isEmotePickerOpen ? "#9ACD32" : "#2a2a2a",
                      justifyContent: "center",
                      alignItems: "center",
                      marginRight: 8,
                      opacity: isSending || !canSendChat ? 0.6 : 1,
                    }}
                  >
                    <Smile size={20} color={isEmotePickerOpen ? "#000" : "#999"} />
                  </TouchableOpacity>

                  <TextInput
                    value={chatMessage}
                    onChangeText={setChatMessage}
                    placeholder="Type a message..."
                    placeholderTextColor="#666"
                    style={{
                      flex: 1,
                      height: 48,
                      backgroundColor: "#2a2a2a",
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      color: "#fff",
                      fontSize: 14,
                      marginRight: 8,
                    }}
                    returnKeyType="send"
                    onSubmitEditing={handleSendMessage}
                    editable={!isSending}
                  />

                  <TouchableOpacity
                    onPress={handleSendMessage}
                    disabled={!chatMessage.trim() || isSending || !canSendChat}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: chatMessage.trim() && !isSending && canSendChat ? "#9ACD32" : "#2a2a2a",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    {isSending ? (
                      <ActivityIndicator size="small" color="#9ACD32" />
                    ) : (
                      <Send size={20} color={chatMessage.trim() && !isSending && canSendChat ? "#000" : "#666"} />
                    )}
                  </TouchableOpacity>
                </View>

                {isEmotePickerOpen ? (
                  <View
                    style={{
                      backgroundColor: "#171717",
                      borderRadius: 12,
                      padding: 10,
                      marginBottom: 24,
                      borderWidth: 1,
                      borderColor: "#2a2a2a",
                    }}
                  >
                    <ScrollView
                      style={{ maxHeight: 190 }}
                      showsVerticalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                    >
                      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                        {EMOTE_IDS.map((emoteId) => {
                          const emoteUri = getEmoteUriFromBody(`:emote:${emoteId}`);
                          if (!emoteUri) return null;
                          return (
                            <TouchableOpacity
                              key={emoteId}
                              onPress={() => handleSendEmote(emoteId)}
                              disabled={isSending}
                              style={{
                                width: 46,
                                height: 46,
                                borderRadius: 10,
                                backgroundColor: "#222",
                                justifyContent: "center",
                                alignItems: "center",
                                marginRight: 8,
                                marginBottom: 8,
                                opacity: isSending ? 0.6 : 1,
                              }}
                            >
                              <Image
                                source={{ uri: emoteUri }}
                                style={{ width: 34, height: 34 }}
                                contentFit="contain"
                              />
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </ScrollView>
                  </View>
                ) : null}
              </>
            ) : (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#2a2a2a",
                  borderRadius: 12,
                  paddingVertical: 12,
                  marginBottom: 24,
                }}
              >
                <ActivityIndicator size="small" color="#9ACD32" />
                <Text style={{ color: "#999", marginLeft: 10, fontSize: 13 }}>
                  Finalizing secure chat connection...
                </Text>
              </View>
            )
          ) : null}

          {/* Chat Messages */}
          {messagesStatus === "LoadingFirstPage" ? (
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <ActivityIndicator size="large" color="#9ACD32" />
              <Text style={{ color: "#666", marginTop: 12 }}>Loading messages...</Text>
            </View>
          ) : messages && messages.length > 0 ? (
            <>
              {/* Messages are returned newest-first from query */}
              {messages.map((msg, index) => {
                const rawBody = typeof msg.body === "string" ? msg.body : "";
                const emoteUri = getEmoteUriFromBody(rawBody);
                const cratePurchase = parseCratePurchaseToken(rawBody);
                const auctionEvent = parseAuctionToken(rawBody);
                const isGifUpload =
                  msg.imageMimeType === "image/gif" ||
                  (typeof msg.imageUrl === "string" && msg.imageUrl.toLowerCase().includes(".gif"));

                if (cratePurchase) {
                  return (
                    <View key={msg._id} style={{ marginBottom: index < messages.length - 1 ? 20 : 0 }}>
                      <View
                        style={{
                          backgroundColor: "#3b0764",
                          borderColor: "#86198f",
                          borderWidth: 1,
                          borderRadius: 12,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          flexDirection: "row",
                          alignItems: "center",
                        }}
                      >
                        <Text style={{ fontSize: 18, marginRight: 8 }}>💿</Text>
                        <Text style={{ color: "#fff", fontSize: 14, flex: 1, lineHeight: 20 }}>
                          <Text style={{ color: "#e879f9", fontWeight: "700" }}>
                            {msg.userName || "Someone"}
                          </Text>
                          {" added a track to their crate for "}
                          <Text style={{ color: "#fff", fontWeight: "700" }}>
                            ${Math.round(cratePurchase.amount / 100)}
                          </Text>
                        </Text>
                      </View>
                    </View>
                  );
                }

                if (auctionEvent) {
                  const isWon = auctionEvent.type === "auction_won";
                  const isOutbid = auctionEvent.type === "outbid";
                  const verb = isWon
                    ? "won the auction for"
                    : isOutbid
                      ? "outbid with"
                      : "placed a bid of";

                  return (
                    <View key={msg._id} style={{ marginBottom: index < messages.length - 1 ? 20 : 0 }}>
                      <View
                        style={{
                          backgroundColor: isWon ? "#274e13" : "#3b0764",
                          borderColor: isWon ? "#65a30d" : "#86198f",
                          borderWidth: 1,
                          borderRadius: 12,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          flexDirection: "row",
                          alignItems: "center",
                        }}
                      >
                        <Text style={{ fontSize: 18, marginRight: 8 }}>{isWon ? "🏆" : "🔨"}</Text>
                        <Text style={{ color: "#fff", fontSize: 14, flex: 1, lineHeight: 20 }}>
                          <Text
                            style={{
                              color: isWon ? "#c4ff0e" : "#e879f9",
                              fontWeight: "700",
                            }}
                          >
                            {msg.userName || "Someone"}
                          </Text>
                          {` ${verb} `}
                          <Text style={{ color: "#fff", fontWeight: "700" }}>
                            ${Math.round(auctionEvent.amount / 100)}
                          </Text>
                          {isWon ? " 🎉" : ""}
                        </Text>
                      </View>
                    </View>
                  );
                }

                return (
                <Pressable
                  key={msg._id}
                  onPress={() => handleMessageTap(msg._id)}
                  style={{ marginBottom: index < messages.length - 1 ? 20 : 0, position: "relative" }}
                >
                <View style={{ flexDirection: "row" }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: "#E91E63",
                      marginRight: 12,
                      overflow: "hidden",
                    }}
                  >
                    {msg.avatarUrl ? (
                      <Image source={{ uri: msg.avatarUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                    ) : (
                      <View style={{ width: "100%", height: "100%", justifyContent: "center", alignItems: "center" }}>
                        <Text style={{ color: "#fff", fontWeight: "700" }}>
                          {(msg.userName || msg.user || "U")[0].toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                      <Text style={{ color: "#9ACD32", fontSize: 16, fontWeight: "600", marginRight: 8 }}>
                        {msg.userName || msg.user || "User"}
                      </Text>
                      <Text style={{ color: "#666", fontSize: 14 }}>
                        · {new Date(msg._creationTime).toLocaleDateString()}
                      </Text>
                    </View>

                    {emoteUri ? (
                      <View style={{ marginBottom: 8 }}>
                        <Image
                          source={{ uri: emoteUri }}
                          style={{
                            width: "100%",
                            maxWidth: 280,
                            aspectRatio: 1,
                            borderRadius: 12,
                          }}
                          contentFit="contain"
                        />
                      </View>
                    ) : null}

                    {rawBody && !emoteUri ? (
                      <Text style={{ color: "#fff", fontSize: 15, lineHeight: 22, marginBottom: 8 }}>
                        {rawBody}
                      </Text>
                    ) : null}

                    {msg.imageUrl ? (
                      <View style={{ marginBottom: 8 }}>
                        <Image
                          source={{ uri: msg.imageUrl }}
                          style={{
                            width: "100%",
                            maxWidth: 280,
                            height: 200,
                            borderRadius: 12,
                          }}
                          contentFit={isGifUpload ? "contain" : "cover"}
                        />
                      </View>
                    ) : null}

                    {/* Likes */}
                    {msg.loveCount > 0 && (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          backgroundColor: "#DC2626",
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 16,
                          alignSelf: "flex-start",
                        }}
                      >
                        <Heart size={14} color="#fff" fill="#fff" />
                        <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700", marginLeft: 6 }}>
                          {msg.loveCount}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Double-tap heart animation overlay */}
                {loveAnimatingId === msg._id && (
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      justifyContent: "center",
                      alignItems: "center",
                      pointerEvents: "none",
                    }}
                  >
                    <Heart size={48} color="#DC2626" fill="#DC2626" style={{ opacity: 0.85 }} />
                  </View>
                )}
              </Pressable>
                );
              })}

              {/* Loading indicator when fetching more */}
              {isLoadingMore && (
                <View style={{ alignItems: "center", paddingVertical: 20 }}>
                  <ActivityIndicator size="small" color="#9ACD32" />
                  <Text style={{ color: "#666", marginTop: 8, fontSize: 12 }}>Loading more...</Text>
                </View>
              )}
              {canLoadMore && !isLoadingMore && (
                <Text style={{ color: "#444", textAlign: "center", marginTop: 16, fontSize: 12 }}>
                  Scroll down for more messages
                </Text>
              )}
            </>
          ) : (
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <MessageCircle size={48} color="#333" />
              <Text style={{ color: "#666", marginTop: 12, fontSize: 16 }}>No messages yet</Text>
              <Text style={{ color: "#444", marginTop: 4, fontSize: 14 }}>Be the first to say something!</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Notifications Modal */}
      <Modal
        visible={isNotificationsOpen}
        animationType="slide"
        transparent
        onRequestClose={handleCloseNotifications}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }}>
          <Pressable
            onPress={handleCloseNotifications}
            style={{ height: insets.top + 60 }}
          />
          <View
            style={{
              flex: 1,
              backgroundColor: "#111",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 20,
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: "#222",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>Notifications</Text>
              <TouchableOpacity onPress={handleCloseNotifications}>
                <X size={24} color="#999" />
              </TouchableOpacity>
            </View>

            {/* Notification List */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
              {!notifications ? (
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <ActivityIndicator size="large" color="#9ACD32" />
                </View>
              ) : notifications.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <Inbox size={48} color="#333" />
                  <Text style={{ color: "#666", marginTop: 12, fontSize: 16 }}>No notifications yet</Text>
                </View>
              ) : (
                notifications.map((notif) => {
                  const isUnread = !notif.isRead;
                  const NotifIcon =
                    notif.type === "mention" ? MessageSquare
                    : notif.type === "follow" ? UserPlus
                    : notif.type === "reply" ? Reply
                    : notif.type === "go_live" ? Radio
                    : Inbox;
                  const iconColor =
                    notif.type === "mention" ? "#60a5fa"
                    : notif.type === "follow" ? "#c4ff0e"
                    : notif.type === "reply" ? "#c084fc"
                    : notif.type === "go_live" ? "#ef4444"
                    : "#a1a1aa";
                  const label =
                    notif.type === "mention" ? "mentioned you"
                    : notif.type === "follow" ? "followed you"
                    : notif.type === "reply" ? "replied to you"
                    : notif.type === "go_live" ? "went live"
                    : "notification";

                  return (
                    <View
                      key={notif._id}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 20,
                        paddingVertical: 14,
                        backgroundColor: isUnread ? "rgba(39,39,42,0.3)" : "transparent",
                        borderBottomWidth: 1,
                        borderBottomColor: "#1a1a1a",
                      }}
                    >
                      {/* Unread dot */}
                      <View style={{ width: 8, marginRight: 10 }}>
                        {isUnread && (
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#c4ff0e" }} />
                        )}
                      </View>

                      {/* Avatar or icon */}
                      {notif.fromAvatarUrl ? (
                        <Image
                          source={{ uri: notif.fromAvatarUrl }}
                          style={{ width: 36, height: 36, borderRadius: 18, marginRight: 12 }}
                          contentFit="cover"
                        />
                      ) : (
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: "#222",
                            justifyContent: "center",
                            alignItems: "center",
                            marginRight: 12,
                          }}
                        >
                          <NotifIcon size={18} color={iconColor} />
                        </View>
                      )}

                      {/* Content */}
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: isUnread ? "#fff" : "#999", fontSize: 14, lineHeight: 20 }}>
                          <Text style={{ fontWeight: "700", color: isUnread ? "#c4ff0e" : "#999" }}>
                            {notif.fromUserName || "Someone"}
                          </Text>
                          {" "}{label}
                        </Text>
                        <Text style={{ color: "#555", fontSize: 12, marginTop: 2 }}>
                          {new Date(notif.createdAt).toLocaleDateString()}
                        </Text>
                      </View>

                      <NotifIcon size={16} color={iconColor} />
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingAnimatedView>
  );
}
