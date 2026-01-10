import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  TextInput,
  ActivityIndicator,
  AppState,
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
} from "lucide-react-native";
import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, usePaginatedQuery } from "convex/react";
import { useUser, useAuth } from "@clerk/clerk-expo";
import { api } from "convex/_generated/api";
import { useVideoPlayer, VideoView } from "expo-video";
import KeyboardAvoidingAnimatedView from "@/components/KeyboardAvoidingAnimatedView";

export default function Index() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { isSignedIn } = useAuth();
  const [chatMessage, setChatMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [hasHearted, setHasHearted] = useState(false);
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

  // Paginated messages - loads 15 at a time, newest first for display
  const {
    results: messages,
    status: messagesStatus,
    loadMore,
  } = usePaginatedQuery(api.chat.getMessagesPage, {}, { initialNumItems: 15 });

  const isLoadingMore = messagesStatus === "LoadingMore";
  const canLoadMore = messagesStatus === "CanLoadMore";

  // Auto-load more messages when scrolling near bottom
  const handleScroll = useCallback((event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 100; // pixels from bottom to trigger load
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;

    if (isCloseToBottom && canLoadMore && !isLoadingMore) {
      loadMore(15);
    }
  }, [canLoadMore, isLoadingMore, loadMore]);

  // Get video from playbackState, or fall back to defaultVideo, or any public video
  const currentVideo = playbackState?.video || defaultVideo || publicVideos?.[0];

  // Convex mutations
  const sendMessage = useMutation(api.chat.sendMessage);
  const incrementHeart = useMutation(api.videos.incrementHeartCount);

  // Video player setup - use playbackUrl from the video
  // For iOS HLS playback, we need to specify contentType
  const videoSource = currentVideo?.playbackUrl
    ? { uri: currentVideo.playbackUrl, contentType: 'hls' }
    : null;

  // Debug logging
  useEffect(() => {
    console.log("=== VIDEO DEBUG ===");
    console.log("PlaybackState startTime:", playbackState?.startTime);
    console.log("DefaultVideo startTime:", defaultVideo?.startTime);
    console.log("Current Video:", currentVideo?.title, "duration:", currentVideo?.duration);
    console.log("Video Source:", videoSource?.uri ? "SET" : "NULL");
    console.log("==================");
  }, [playbackState, defaultVideo, currentVideo, videoSource]);

  // Debug image URLs
  useEffect(() => {
    console.log("=== IMAGE DEBUG ===");
    console.log("User imageUrl:", user?.imageUrl);
    if (messages && messages.length > 0) {
      console.log("First message avatarUrl:", messages[0]?.avatarUrl);
    }
    console.log("==================");
  }, [user?.imageUrl, messages]);

  const player = useVideoPlayer(videoSource, (player) => {
    player.loop = true;
    player.play();
  });

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
  useEffect(() => {
    if (!player || !globalStartTime || !videoDurationForSync || hasSyncedPlayback) {
      return;
    }

    const syncToGlobalTime = () => {
      const now = Date.now();
      const elapsedSeconds = (now - globalStartTime) / 1000;
      const duration = videoDurationForSync;

      // Calculate position with looping (same as web)
      const syncedPosition = duration > 0 ? elapsedSeconds % duration : elapsedSeconds;

      console.log("=== SYNC DEBUG ===");
      console.log("Global startTime:", globalStartTime);
      console.log("Now:", now);
      console.log("Elapsed seconds:", elapsedSeconds);
      console.log("Duration:", duration);
      console.log("Synced position:", syncedPosition);
      console.log("==================");

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
      if (nextAppState === "active" && player && globalStartTime && videoDurationForSync) {
        // Re-calculate and sync position
        const now = Date.now();
        const elapsedSeconds = (now - globalStartTime) / 1000;
        const syncedPosition = videoDurationForSync > 0
          ? elapsedSeconds % videoDurationForSync
          : elapsedSeconds;

        console.log("App became active, re-syncing to position:", syncedPosition);

        if (syncedPosition >= 0 && syncedPosition < videoDurationForSync) {
          player.currentTime = syncedPosition;
        }

        // Resume playback
        player.play();
      }
    });

    return () => subscription.remove();
  }, [player, globalStartTime, videoDurationForSync]);

  const toggleLike = useCallback(async () => {
    if (!playbackState?.videoId || hasHearted) return;
    setHasHearted(true);
    try {
      await incrementHeart({ videoId: playbackState.videoId });
    } catch (error) {
      console.error("Heart error:", error);
      setHasHearted(false);
    }
  }, [playbackState?.videoId, hasHearted, incrementHeart]);

  const handleSendMessage = useCallback(async () => {
    if (!chatMessage.trim() || isSending || !isSignedIn || !user) return;

    const body = chatMessage.trim();
    setChatMessage("");
    setIsSending(true);

    try {
      await sendMessage({
        body,
        userId: user.id,
        userName: user.firstName || user.username || "User",
        avatarUrl: user.imageUrl,
      });
    } catch (error) {
      console.error("Send message error:", error);
      setChatMessage(body);
    } finally {
      setIsSending(false);
    }
  }, [chatMessage, isSending, isSignedIn, user, sendMessage]);

  const isLive = !!activeStream;
  const videoTitle = currentVideo?.title || "Loading...";
  const heartCount = currentVideo?.heartCount || 0;
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

          {/* Live indicator */}
          {isLive && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#DC2626",
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
                gap: 6,
              }}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" }} />
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>LIVE</Text>
            </View>
          )}
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
                flexDirection: "column",
                gap: 12,
              }}
            >
              <TouchableOpacity
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: "rgba(0,0,0,0.5)",
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
                onPress={toggleLike}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  backgroundColor: hasHearted ? "#E91E63" : "#DC2626",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Heart size={24} color="#fff" fill={hasHearted ? "#fff" : "none"} />
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16, marginTop: 4 }}>
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
          {isSignedIn && user ? (
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
                {user.imageUrl ? (
                  <Image source={{ uri: user.imageUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                ) : (
                  <View style={{ width: "100%", height: "100%", justifyContent: "center", alignItems: "center" }}>
                    <Text style={{ color: "#fff", fontWeight: "700" }}>
                      {(user.firstName || user.username || "U")[0].toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={{ color: "#9ACD32", fontSize: 16, fontWeight: "600" }}>
                {user.firstName || user.username || "You"}
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
            >
              <LogIn size={20} color="#000" />
              <Text style={{ color: "#000", fontWeight: "700", marginLeft: 8 }}>Sign in to chat</Text>
            </TouchableOpacity>
          )}

          {/* Chat Input */}
          {isSignedIn && (
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 24 }}>
              <TouchableOpacity
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: "#2a2a2a",
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: 8,
                }}
              >
                <ImageIcon size={20} color="#999" />
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: "#2a2a2a",
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: 8,
                }}
              >
                <Smile size={20} color="#999" />
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
                disabled={!chatMessage.trim() || isSending}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: chatMessage.trim() && !isSending ? "#9ACD32" : "#2a2a2a",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Send size={20} color={chatMessage.trim() && !isSending ? "#000" : "#666"} />
              </TouchableOpacity>
            </View>
          )}

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
                const isGifUpload =
                  msg.imageMimeType === "image/gif" ||
                  (typeof msg.imageUrl === "string" && msg.imageUrl.toLowerCase().includes(".gif"));
                return (
                <View key={msg._id} style={{ marginBottom: index < messages.length - 1 ? 20 : 0 }}>
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

                    {msg.body ? (
                      <Text style={{ color: "#fff", fontSize: 15, lineHeight: 22, marginBottom: 8 }}>
                        {msg.body}
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
              </View>
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
    </KeyboardAvoidingAnimatedView>
  );
}
