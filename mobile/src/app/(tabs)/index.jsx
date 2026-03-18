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
  useWindowDimensions,
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
import { useState, useRef, useCallback, useEffect, useContext } from "react";
import { useQuery, useMutation, usePaginatedQuery, useConvexAuth } from "convex/react";
import { api } from "convex/_generated/api";
import { useVideoPlayer, VideoView, VideoAirPlayButton } from "expo-video";
import KeyboardAvoidingAnimatedView from "@/components/KeyboardAvoidingAnimatedView";
import { useRouter } from "expo-router";
import { useFAPIAuth } from "@/lib/fapi-auth";
import AuctionPanel from "@/components/AuctionPanel";
import ClipShareButton from "@/components/ClipShareButton";
import { ScrollToTopContext } from "./_layout";
import { ActivePlayerContext } from "../_layout";
import LivestreamPPVGate from "@/components/LivestreamPPVGate";
import LogoShimmer from "@/components/LogoShimmer";
import * as ImagePicker from "expo-image-picker";
import * as Clipboard from "expo-clipboard";
import * as ScreenOrientation from "expo-screen-orientation";
import { TextInputWrapper } from "expo-paste-input";

const EMOTE_TOKEN_PATTERN = /^:emote:([^\s]+)$/;
const TIP_PATTERN = /^:tip:(.+)$/;
const CRATE_PURCHASE_PATTERN = /^:crate_purchase:(.+)$/;
const AUCTION_PATTERN = /^:auction:(.+)$/;
const EMOTE_ID_PATTERN = /^[A-Za-z0-9._-]+$/;
const DEFAULT_EMOTE_BASE_URL = "https://www.dreaminaudio.xyz";
const EMOTE_IDS = Array.from({ length: 79 }, (_, index) => `image${index}.png`);
const MAX_CHAT_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;

const GIF_URL_PATTERN =
  /https?:\/\/[^\s]+\.gif(\?[^\s]*)?|https?:\/\/(media\.giphy\.com|giphy\.com|media\.tenor\.com|tenor\.com|imgur\.com|i\.imgur\.com)\/[^\s]+/gi;

const normalizeGifUrl = (rawUrl) => {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./, "");
    const path = url.pathname;
    const lastSegment = path.split("/").filter(Boolean).pop() ?? "";

    if (path.toLowerCase().endsWith(".gif")) {
      return rawUrl;
    }

    if (host === "giphy.com" || host === "media.giphy.com") {
      const id =
        (path.match(/\/media\/([^/]+)/)?.[1] ?? lastSegment.split("-").pop()) || "";
      return id ? `https://media.giphy.com/media/${id}/giphy.gif` : rawUrl;
    }

    if (host === "tenor.com" || host === "media.tenor.com") {
      const itemId = url.searchParams.get("itemid");
      const id = itemId ?? lastSegment.split("-").pop();
      return id ? `https://media.tenor.com/${id}/tenor.gif` : rawUrl;
    }

    if (host === "imgur.com") {
      return lastSegment ? `https://i.imgur.com/${lastSegment}.gif` : rawUrl;
    }

    if (host === "i.imgur.com") {
      return rawUrl;
    }

    return rawUrl;
  } catch {
    return rawUrl;
  }
};

const extractGifUrls = (body) => {
  const matches = body.match(GIF_URL_PATTERN) ?? [];
  const urls = Array.from(
    new Set(matches.map((match) => normalizeGifUrl(match.trim())))
  ).filter(Boolean);
  const text = body.replace(GIF_URL_PATTERN, " ").replace(/\s{2,}/g, " ").trim();
  return { text, urls };
};

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

const TIP_EMOJI_MAP = { fire: "\u{1F525}", heart: "\u2764\uFE0F", rocket: "\u{1F680}", clap: "\u{1F44F}" };

const formatReplyBody = (body) => {
  if (typeof body !== "string") return "";
  const tipMatch = body.trim().match(TIP_PATTERN);
  if (tipMatch) {
    try {
      const parsed = JSON.parse(tipMatch[1]);
      if (parsed && typeof parsed.amount === "number") {
        return `Tipped $${(parsed.amount / 100).toFixed(2)}`;
      }
    } catch {}
    return "Tipped";
  }
  const crateMatch = body.trim().match(CRATE_PURCHASE_PATTERN);
  if (crateMatch) {
    try {
      const parsed = JSON.parse(crateMatch[1]);
      if (parsed && typeof parsed.amount === "number") {
        return `Added a track to their crate for $${Math.round(parsed.amount / 100)}`;
      }
    } catch {}
    return "Crate purchase";
  }
  const auctionMatch = body.trim().match(AUCTION_PATTERN);
  if (auctionMatch) {
    try {
      const parsed = JSON.parse(auctionMatch[1]);
      if (parsed && typeof parsed.amount === "number") {
        const verb = parsed.type === "auction_won" ? "Won the auction for" : parsed.type === "outbid" ? "Outbid with" : "Placed a bid of";
        return `${verb} $${Math.round(parsed.amount / 100)}`;
      }
    } catch {}
    return "Auction bid";
  }
  const emoteMatch = body.trim().match(EMOTE_TOKEN_PATTERN);
  if (emoteMatch) return "Sent an emote";
  return body;
};

const parseTipToken = (body) => {
  if (typeof body !== "string") return null;
  const match = body.trim().match(TIP_PATTERN);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1]);
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.amount !== "number") return null;
    return {
      amount: parsed.amount,
      emoji: parsed.emoji || null,
      message: parsed.message || null,
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

function StreamPPVWrapper({ activeStream, videoHeight, children }) {
  const router = useRouter();
  const onRequireSignIn = useCallback(() => router.push("/sign-in"), [router]);
  if (activeStream?.visibility !== "ppv" || !activeStream?._id) return children;
  return (
    <LivestreamPPVGate
      livestreamId={activeStream._id}
      title={activeStream.title}
      price={activeStream.price ?? 999}
      videoHeight={videoHeight}
      onRequireSignIn={onRequireSignIn}
    >
      {children}
    </LivestreamPPVGate>
  );
}

export default function Index() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isSignedIn, user, sessionId } = useFAPIAuth();
  const { isAuthenticated: isConvexAuthenticated, isLoading: isConvexAuthLoading } = useConvexAuth();
  const [chatMessage, setChatMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isEmotePickerOpen, setIsEmotePickerOpen] = useState(false);
  const [isHeartAnimating, setIsHeartAnimating] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [loveAnimatingId, setLoveAnimatingId] = useState(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const lastTapRef = useRef({ messageId: null, time: 0 });
  const videoTapRef = useRef(0);
  const [videoHeartVisible, setVideoHeartVisible] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [hasSyncedPlayback, setHasSyncedPlayback] = useState(false);
  const videoViewRef = useRef(null);
  const scrollViewRef = useRef(null);
  const [replyingTo, setReplyingTo] = useState(null); // { id, userName, body }
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [scrollTargetId, setScrollTargetId] = useState(null);
  const [expandedNotifId, setExpandedNotifId] = useState(null);
  const [mentionSearch, setMentionSearch] = useState("");
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionPosition, setMentionPosition] = useState(null);
  const chatInputRef = useRef(null);
  const chatInputYRef = useRef(0);
  const messageLayoutsRef = useRef({}); // {[msgId]: y} from onLayout

  const scrollToTopSignal = useContext(ScrollToTopContext);
  useEffect(() => {
    if (scrollToTopSignal.route === "index" && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: 0, animated: true });
    }
  }, [scrollToTopSignal.count]);

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

  const mentionResults = useQuery(
    api.users.searchUsersByAlias,
    showMentionPopup ? { searchTerm: mentionSearch } : "skip"
  );

  // Auto-load more messages when scrolling near bottom
  const handleScroll = useCallback((event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 100; // pixels from bottom to trigger load
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;

    if (isCloseToBottom && canLoadMore && !isLoadingMore) {
      loadMore(15);
    }
  }, [canLoadMore, isLoadingMore, loadMore]);

  // Check if scroll target is in the already-loaded messages
  const scrollTargetInLoaded = scrollTargetId && messages?.some((m) => m._id === scrollTargetId);

  // Derive expanded notification and fetch its referenced message
  const expandedNotif = expandedNotifId && notifications?.find((n) => n._id === expandedNotifId);
  const expandedMessageId = expandedNotif?.messageId || null;
  const expandedMessage = useQuery(
    api.chat.getMessageById,
    expandedMessageId ? { messageId: expandedMessageId } : "skip"
  );
  const expandedMessageInLoaded = expandedMessageId && messages?.some((m) => m._id === expandedMessageId);

  // If message is already loaded, scroll to it
  useEffect(() => {
    if (!scrollTargetId || !scrollTargetInLoaded) return;

    setTimeout(() => {
      const yPos = messageLayoutsRef.current[scrollTargetId];
      if (yPos !== undefined && scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: Math.max(0, yPos - 80), animated: true });
      }
      setHighlightedMessageId(scrollTargetId);
      setScrollTargetId(null);
      setTimeout(() => setHighlightedMessageId(null), 2000);
    }, 150);
  }, [scrollTargetId, scrollTargetInLoaded]);

  // Unlock orientation when fullscreen, lock back to portrait when not
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

  // Derive landscape from window dimensions (works inside Modal native rotation)
  const { width: winW, height: winH } = useWindowDimensions();
  const isLandscape = isFullscreen && winW > winH;

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

  // Pause/resume when another screen takes over audio
  const { activePlayer } = useContext(ActivePlayerContext);
  const activePlayerRef = useRef(activePlayer);
  useEffect(() => { activePlayerRef.current = activePlayer; }, [activePlayer]);

  useEffect(() => {
    if (!player) return;
    if (activePlayer !== "home") {
      player.pause();
    } else {
      player.play();
    }
  }, [player, activePlayer]);

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
        // Don't resume if another screen owns audio (e.g. watch screen after PPV purchase)
        if (activePlayerRef.current !== "home") return;

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

  const handleMessageTap = useCallback((messageId) => {
    const now = Date.now();
    const last = lastTapRef.current;

    if (last.messageId === messageId && now - last.time < 300) {
      // Double tap detected
      lastTapRef.current = { messageId: null, time: 0 };
      handleLoveMessage(messageId);
    } else {
      lastTapRef.current = { messageId, time: now };
    }
  }, [canSendChat, loveMessage]);

  const handleLoveMessage = useCallback((messageId) => {
    if (!canSendChat) {
      Alert.alert("Sign in required", "You need to sign in to like messages.", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign in", onPress: () => router.push("/sign-in") },
      ]);
      return;
    }
    setLoveAnimatingId(messageId);
    setTimeout(() => setLoveAnimatingId(null), 600);
    loveMessage({ messageId }).catch((error) => {
      console.error("[Chat] loveMessage failed:", error?.message || error);
    });
  }, [canSendChat, loveMessage, router]);

  const handleOpenNotifications = useCallback(() => {
    setIsNotificationsOpen(true);
  }, []);

  const handleCloseNotifications = useCallback(() => {
    setIsNotificationsOpen(false);
    setExpandedNotifId(null);
    markAllAsRead().catch((e) => console.error("[Notifications] markAllAsRead failed:", e));
  }, [markAllAsRead]);

  const handleNotificationTap = useCallback((notif) => {
    if (!notif.messageId) return;
    if (notif.type !== "mention" && notif.type !== "reply") return;

    if (expandedNotifId === notif._id) {
      // Second tap on already-expanded notification
      const inLoaded = messages?.some((m) => m._id === notif.messageId);
      if (inLoaded) {
        // Close drawer and scroll to the message in chat
        handleCloseNotifications();
        setTimeout(() => setScrollTargetId(notif.messageId), 100);
      } else {
        // Not in loaded set — just collapse
        setExpandedNotifId(null);
      }
    } else {
      // First tap — expand inline
      setExpandedNotifId(notif._id);
    }
  }, [expandedNotifId, messages, handleCloseNotifications]);

  const handleSendMessage = useCallback(async () => {
    if (!chatMessage.trim() || isSending || !canSendChat) return;

    const body = chatMessage.trim();
    const currentReply = replyingTo;
    setChatMessage("");
    setIsEmotePickerOpen(false);
    setReplyingTo(null);
    setShowMentionPopup(false);
    setMentionSearch("");
    setMentionPosition(null);
    setIsSending(true);

    try {
      const args = { body };
      if (currentReply?.id) args.replyToId = currentReply.id;
      await sendMessage(args);
    } catch (error) {
      console.error("[Chat] sendMessage failed:", error?.message || error);
      setChatMessage(body);
    } finally {
      setIsSending(false);
    }
  }, [chatMessage, isSending, isSignedIn, isConvexAuthenticated, canSendChat, sendMessage, replyingTo]);

  const updateMentionState = useCallback((value) => {
    const mentionMatch = value.match(/@([\w.-]*)$/);
    if (mentionMatch) {
      setMentionSearch(mentionMatch[1]);
      setShowMentionPopup(true);
      setMentionPosition(value.lastIndexOf("@"));
    } else {
      setShowMentionPopup(false);
      setMentionSearch("");
      setMentionPosition(null);
    }
  }, []);

  const insertMention = useCallback((alias) => {
    setChatMessage((prev) => {
      const updated =
        mentionPosition !== null
          ? `${prev.slice(0, mentionPosition)}@${alias} `
          : prev.replace(/@(\w*)$/, `@${alias} `);
      return updated;
    });
    setShowMentionPopup(false);
    setMentionSearch("");
    setMentionPosition(null);
  }, [mentionPosition]);

  const handleToggleEmotePicker = useCallback(() => {
    if (!canSendChat || isSending) return;
    setIsEmotePickerOpen((prev) => !prev);
    setShowMentionPopup(false);
    setMentionSearch("");
    setMentionPosition(null);
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
    const currentReply = replyingTo;

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
      const sendArgs = {
        body: messageText || "",
        imageStorageId: storageId,
        imageMimeType: mimeType,
      };
      if (currentReply?.id) sendArgs.replyToId = currentReply.id;
      await sendMessage(sendArgs);
      if (messageText) {
        setChatMessage("");
      }
      setReplyingTo(null);
    } catch (error) {
      console.error("[Chat] failed to upload photo:", error?.message || error);
      Alert.alert("Upload failed", "We could not send that photo. Please try again.");
    } finally {
      setIsSending(false);
    }
  }, [canSendChat, isSending, chatMessage, generateUploadUrl, sendMessage, replyingTo]);

  const handlePaste = useCallback(async (payload) => {
    if (payload.type !== "images" || !payload.uris?.length) return;
    const currentReply = replyingTo;

    // iOS stores copied URLs as public.url (not public.plain-text), so
    // hasStringAsync() misses them. Check for URLs first, then plain text.
    // If either exists, paste as text instead of uploading the image
    // representation that iOS may have resolved from the URL.
    const clipboardUrl = await Clipboard.getUrlAsync();
    if (clipboardUrl) {
      setChatMessage((prev) => prev + clipboardUrl);
      return;
    }
    const clipboardText = await Clipboard.getStringAsync();
    if (clipboardText) {
      setChatMessage((prev) => prev + clipboardText);
      return;
    }

    if (!canSendChat || isSending) return;

    const uri = payload.uris[0];

    try {
      const localFileResponse = await fetch(uri);
      const localFileBlob = await localFileResponse.blob();

      if (localFileBlob.size > MAX_CHAT_IMAGE_SIZE_BYTES) {
        Alert.alert("Image too large", "Please choose an image under 8MB.");
        return;
      }

      setIsSending(true);
      const mimeType = inferImageMimeType({ uri }, localFileBlob.type);
      const { uploadUrl } = await generateUploadUrl({});
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": mimeType },
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
      const sendArgs = {
        body: messageText || "",
        imageStorageId: storageId,
        imageMimeType: mimeType,
      };
      if (currentReply?.id) sendArgs.replyToId = currentReply.id;
      await sendMessage(sendArgs);
      if (messageText) {
        setChatMessage("");
      }
      setReplyingTo(null);
    } catch (error) {
      console.error("[Chat] failed to upload pasted image:", error?.message || error);
      Alert.alert("Upload failed", "We could not send that image. Please try again.");
    } finally {
      setIsSending(false);
    }
  }, [canSendChat, isSending, chatMessage, generateUploadUrl, sendMessage, replyingTo]);

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
      <StatusBar style="light" hidden={isFullscreen} />

      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={400}
        keyboardShouldPersistTaps="handled"
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
          <LogoShimmer />

          {/* Right side: LIVE badge + Clip + Mute + Notifications */}
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

            <ClipShareButton
              livestreamId={activeStream?._id}
              videoId={heartVideoId}
              currentTime={currentTime}
              streamTitle={videoTitle}
              sessionId={sessionId}
              isLive={isLive}
              provider={currentVideo?.provider}
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
              {isMuted ? (
                <VolumeX size={20} color="#fff" />
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
        <StreamPPVWrapper activeStream={activeStream} videoHeight={videoHeight}>
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
                <Text style={{ color: "#666", marginTop: 12 }}>Loading video...</Text>
              </View>
            )}

            {/* Double-tap heart animation */}
            {videoHeartVisible && (
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
                <Heart size={72} color="#DC2626" fill="#DC2626" style={{ opacity: 0.85 }} />
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
        </StreamPPVWrapper>
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
          onLayout={(e) => { chatInputYRef.current = e.nativeEvent.layout.y; }}
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
                {replyingTo && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: "rgba(39,39,42,0.6)",
                      borderLeftWidth: 3,
                      borderLeftColor: "#9ACD32",
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      marginBottom: 8,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, color: "#9ACD32", fontWeight: "700" }}>
                        Replying to {replyingTo.userName}
                      </Text>
                      <Text style={{ fontSize: 12, color: "#888" }} numberOfLines={1}>
                        {formatReplyBody(replyingTo.body)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setReplyingTo(null)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <X size={16} color="#888" />
                    </TouchableOpacity>
                  </View>
                )}
                {showMentionPopup && (
                  <View
                    style={{
                      backgroundColor: "#171717",
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: "#2a2a2a",
                      maxHeight: 200,
                      marginBottom: 8,
                      overflow: "hidden",
                    }}
                  >
                    <ScrollView
                      keyboardShouldPersistTaps="handled"
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={false}
                    >
                      {mentionResults === undefined && (
                        <View style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
                          <ActivityIndicator size="small" color="#9ACD32" />
                        </View>
                      )}
                      {mentionResults && mentionResults.length === 0 && (
                        <View style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
                          <Text style={{ color: "#666", fontSize: 13 }}>No matches found</Text>
                        </View>
                      )}
                      {mentionResults?.map((mention) => (
                        <TouchableOpacity
                          key={mention._id}
                          onPress={() => insertMention(mention.alias)}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                          }}
                          activeOpacity={0.7}
                        >
                          <View
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 14,
                              backgroundColor: "#2a2a2a",
                              borderWidth: 1,
                              borderColor: "#333",
                              overflow: "hidden",
                              marginRight: 10,
                              justifyContent: "center",
                              alignItems: "center",
                            }}
                          >
                            {mention.selectedAvatar || mention.imageUrl ? (
                              <Image
                                source={{ uri: mention.selectedAvatar || mention.imageUrl }}
                                style={{ width: 28, height: 28 }}
                                contentFit="cover"
                              />
                            ) : (
                              <Text style={{ color: "#aaa", fontSize: 12, fontWeight: "600" }}>
                                {mention.alias.charAt(0).toUpperCase()}
                              </Text>
                            )}
                          </View>
                          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "500" }}>
                            {mention.alias}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
                <View
                  style={{ flexDirection: "row", alignItems: "center", marginBottom: isEmotePickerOpen ? 12 : 24 }}
                >
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

                  <TextInputWrapper
                    onPaste={handlePaste}
                    style={{ flex: 1, marginRight: 8 }}
                  >
                    <TextInput
                      ref={chatInputRef}
                      value={chatMessage}
                      onChangeText={(text) => {
                        setChatMessage(text);
                        updateMentionState(text);
                      }}
                      placeholder="Type a message..."
                      placeholderTextColor="#666"
                      style={{
                        height: 48,
                        backgroundColor: "#2a2a2a",
                        borderRadius: 12,
                        paddingHorizontal: 16,
                        color: "#fff",
                        fontSize: 14,
                      }}
                      returnKeyType="send"
                      onSubmitEditing={handleSendMessage}
                      editable={!isSending}
                    />
                  </TextInputWrapper>

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
                const tipData = parseTipToken(rawBody);
                const cratePurchase = parseCratePurchaseToken(rawBody);
                const auctionEvent = parseAuctionToken(rawBody);
                const isGifUpload =
                  msg.imageMimeType === "image/gif" ||
                  (typeof msg.imageUrl === "string" && msg.imageUrl.toLowerCase().includes(".gif"));

                if (tipData) {
                  return (
                    <View
                      key={msg._id}
                      onLayout={(e) => { messageLayoutsRef.current[msg._id] = e.nativeEvent.layout.y; }}
                      style={{ marginBottom: index < messages.length - 1 ? 20 : 0 }}
                    >
                      <View
                        style={{
                          backgroundColor: "rgba(196, 255, 14, 0.12)",
                          borderColor: highlightedMessageId === msg._id ? "#c4ff0e" : "rgba(196, 255, 14, 0.4)",
                          borderWidth: highlightedMessageId === msg._id ? 2 : 1,
                          borderRadius: 12,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          flexDirection: "row",
                          alignItems: "flex-start",
                        }}
                      >
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: "#c4ff0e",
                            justifyContent: "center",
                            alignItems: "center",
                            marginRight: 10,
                          }}
                        >
                          <Text style={{ fontSize: 20, color: "#000", fontWeight: "700" }}>$</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          {msg.replyTo && (
                            <View style={{ borderLeftWidth: 2, borderLeftColor: "rgba(196,255,14,0.5)", backgroundColor: "rgba(39,39,42,0.5)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, marginBottom: 6 }}>
                              <Text style={{ fontSize: 12, fontWeight: "700", color: "#c4ff0e" }}>{msg.replyTo.userName}</Text>
                              <Text style={{ fontSize: 12, color: "#aaa" }} numberOfLines={1}>{formatReplyBody(msg.replyTo.body)}</Text>
                            </View>
                          )}
                          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                            <Text style={{ color: "#c4ff0e", fontWeight: "700", fontSize: 14 }}>
                              {msg.userName || "Someone"}
                            </Text>
                            <Text style={{ color: "#fff", fontSize: 14 }}> tipped </Text>
                            <View
                              style={{
                                backgroundColor: "#c4ff0e",
                                borderRadius: 12,
                                paddingHorizontal: 8,
                                paddingVertical: 2,
                              }}
                            >
                              <Text style={{ color: "#000", fontWeight: "700", fontSize: 13 }}>
                                ${(tipData.amount / 100).toFixed(2)}
                              </Text>
                            </View>
                            {tipData.emoji && TIP_EMOJI_MAP[tipData.emoji] ? (
                              <Text style={{ fontSize: 20 }}>{TIP_EMOJI_MAP[tipData.emoji]}</Text>
                            ) : null}
                          </View>
                          {tipData.message ? (
                            <View
                              style={{
                                marginTop: 6,
                                backgroundColor: "rgba(0,0,0,0.3)",
                                borderRadius: 8,
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                              }}
                            >
                              <Text style={{ color: "#fff", fontSize: 13, fontStyle: "italic" }}>
                                "{tipData.message}"
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      {/* Actions row for tip */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                        <TouchableOpacity
                          onPress={() => handleLoveMessage(msg._id)}
                          activeOpacity={0.7}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            backgroundColor: msg.loveCount > 0 ? "#DC2626" : "rgba(39,39,42,0.6)",
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 14,
                          }}
                        >
                          <Heart size={12} color="#fff" fill={msg.loveCount > 0 ? "#fff" : "none"} />
                          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700", marginLeft: 4 }}>
                            {msg.loveCount || 0}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setReplyingTo({ id: msg._id, userName: msg.userName || "Someone", body: rawBody })}
                          activeOpacity={0.7}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            backgroundColor: "rgba(39,39,42,0.6)",
                            paddingHorizontal: 8,
                            paddingVertical: 5,
                            borderRadius: 14,
                          }}
                        >
                          <Reply size={12} color="#999" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }

                if (cratePurchase) {
                  return (
                    <View
                      key={msg._id}
                      onLayout={(e) => { messageLayoutsRef.current[msg._id] = e.nativeEvent.layout.y; }}
                      style={{
                        marginBottom: index < messages.length - 1 ? 20 : 0,
                        ...(highlightedMessageId === msg._id ? { borderWidth: 2, borderColor: "#c4ff0e", borderRadius: 12 } : {}),
                      }}
                    >
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
                    <View
                      key={msg._id}
                      onLayout={(e) => { messageLayoutsRef.current[msg._id] = e.nativeEvent.layout.y; }}
                      style={{
                        marginBottom: index < messages.length - 1 ? 20 : 0,
                        ...(highlightedMessageId === msg._id ? { borderWidth: 2, borderColor: "#c4ff0e", borderRadius: 12 } : {}),
                      }}
                    >
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
                  onLayout={(e) => { messageLayoutsRef.current[msg._id] = e.nativeEvent.layout.y; }}
                  style={{
                    marginBottom: index < messages.length - 1 ? 20 : 0,
                    position: "relative",
                    ...(highlightedMessageId === msg._id ? { borderWidth: 2, borderColor: "#c4ff0e", borderRadius: 12, paddingHorizontal: 4 } : {}),
                  }}
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

                    {msg.replyTo && (
                      <View style={{ borderLeftWidth: 2, borderLeftColor: "rgba(196,255,14,0.5)", backgroundColor: "rgba(39,39,42,0.5)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, marginBottom: 6 }}>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: "#c4ff0e" }}>{msg.replyTo.userName}</Text>
                        <Text style={{ fontSize: 12, color: "#aaa" }} numberOfLines={1}>{formatReplyBody(msg.replyTo.body)}</Text>
                      </View>
                    )}

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

                    {rawBody && !emoteUri ? (() => {
                      const { text, urls: gifUrls } = extractGifUrls(rawBody);
                      return (
                        <>
                          {text ? (
                            <Text style={{ color: "#fff", fontSize: 15, lineHeight: 22, marginBottom: 8 }}>
                              {text.split(/(@[\w.-]+)/g).map((part, i) =>
                                part.startsWith("@") ? (
                                  <Text key={i} style={{ color: "#9ACD32", fontWeight: "700" }}>{part}</Text>
                                ) : (
                                  part
                                )
                              )}
                            </Text>
                          ) : null}
                          {gifUrls.map((gifUrl) => (
                            <View key={gifUrl} style={{ marginBottom: 8 }}>
                              <Image
                                source={{ uri: gifUrl }}
                                style={{
                                  width: "100%",
                                  maxWidth: 280,
                                  height: 200,
                                  borderRadius: 12,
                                }}
                                contentFit="contain"
                              />
                            </View>
                          ))}
                        </>
                      );
                    })() : null}

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

                    {/* Likes & Reply */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => handleLoveMessage(msg._id)}
                        activeOpacity={0.7}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          backgroundColor: msg.loveCount > 0 ? "#DC2626" : "rgba(39,39,42,0.6)",
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 16,
                        }}
                      >
                        <Heart size={14} color="#fff" fill={msg.loveCount > 0 ? "#fff" : "none"} />
                        <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700", marginLeft: 6 }}>
                          {msg.loveCount || 0}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setReplyingTo({ id: msg._id, userName: msg.userName || msg.user || "User", body: rawBody })}
                        activeOpacity={0.7}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          backgroundColor: "rgba(39,39,42,0.6)",
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 16,
                        }}
                      >
                        <Reply size={14} color="#999" />
                      </TouchableOpacity>
                      {msg.recentLovers?.length > 0 && (
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          {msg.recentLovers.map((lover) => (
                            <View
                              key={`${msg._id}-${lover.clerkId}`}
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: 10,
                                backgroundColor: "#27272a",
                                borderWidth: 1,
                                borderColor: "#18181b",
                                overflow: "hidden",
                                marginLeft: -4,
                                justifyContent: "center",
                                alignItems: "center",
                              }}
                            >
                              {lover.avatarUrl ? (
                                <Image source={{ uri: lover.avatarUrl }} style={{ width: 20, height: 20 }} contentFit="cover" />
                              ) : (
                                <Text style={{ color: "#fff", fontSize: 9, fontWeight: "700" }}>
                                  {(lover.alias || "U").charAt(0).toUpperCase()}
                                </Text>
                              )}
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
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

      {/* Fullscreen Video Modal */}
      <Modal
        visible={isFullscreen}
        animationType="fade"
        supportedOrientations={["portrait", "landscape-left", "landscape-right"]}
        onRequestClose={() => setIsFullscreen(false)}
      >
        {isLandscape ? (
          /* Landscape: flex row — button column + video area, no overlay */
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
          /* Portrait: video fills screen, buttons overlay */
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
                  const hasMessageLink = notif.messageId && (notif.type === "mention" || notif.type === "reply");
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

                  const isExpanded = expandedNotifId === notif._id;
                  const msgForPreview = isExpanded ? expandedMessage : null;
                  const canViewInChat = isExpanded && expandedMessageInLoaded;

                  return (
                    <View key={notif._id}>
                      <Pressable
                        onPress={() => hasMessageLink && handleNotificationTap(notif)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingHorizontal: 20,
                          paddingVertical: 14,
                          backgroundColor: isExpanded ? "rgba(39,39,42,0.5)" : isUnread ? "rgba(39,39,42,0.3)" : "transparent",
                          borderBottomWidth: isExpanded ? 0 : 1,
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
                      </Pressable>

                      {/* Expanded message card */}
                      {isExpanded && (
                        <View
                          style={{
                            marginHorizontal: 0,
                            marginTop: 4,
                            marginBottom: 8,
                            backgroundColor: "#1a1a1f",
                            borderRadius: 16,
                            padding: 20,
                          }}
                        >
                          {!msgForPreview ? (
                            <View style={{ alignItems: "center", paddingVertical: 20 }}>
                              <ActivityIndicator size="small" color={iconColor} />
                              <Text style={{ color: "#555", fontSize: 13, marginTop: 8 }}>Loading message...</Text>
                            </View>
                          ) : (
                            <>
                              {/* Sender row: avatar + name + date */}
                              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
                                <View
                                  style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 22,
                                    backgroundColor: "#9ACD32",
                                    marginRight: 12,
                                    overflow: "hidden",
                                    justifyContent: "center",
                                    alignItems: "center",
                                  }}
                                >
                                  {msgForPreview.avatarUrl ? (
                                    <Image source={{ uri: msgForPreview.avatarUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                                  ) : (
                                    <Text style={{ color: "#000", fontWeight: "800", fontSize: 18 }}>
                                      {(msgForPreview.userName || "U")[0].toUpperCase()}
                                    </Text>
                                  )}
                                </View>
                                <View>
                                  <Text style={{ color: "#fff", fontSize: 17, fontWeight: "700" }}>
                                    {msgForPreview.userName || "User"}
                                  </Text>
                                  <Text style={{ color: "#666", fontSize: 13, marginTop: 1 }}>
                                    {new Date(msgForPreview._creationTime).toLocaleDateString()}
                                  </Text>
                                </View>
                              </View>

                              {/* Message body */}
                              {(() => {
                                const body = typeof msgForPreview.body === "string" ? msgForPreview.body : "";
                                const previewEmoteUri = getEmoteUriFromBody(body);
                                if (previewEmoteUri) {
                                  return (
                                    <Image
                                      source={{ uri: previewEmoteUri }}
                                      style={{ width: 80, height: 80, borderRadius: 10, marginBottom: 16 }}
                                      contentFit="contain"
                                    />
                                  );
                                }
                                const displayBody = formatReplyBody(body);
                                if (!displayBody) return null;
                                // Highlight @mentions in green
                                const parts = displayBody.split(/(@\w+)/g);
                                return (
                                  <Text style={{ color: "#fff", fontSize: 18, fontWeight: "600", lineHeight: 26, marginBottom: 16 }}>
                                    {parts.map((part, i) =>
                                      part.startsWith("@") ? (
                                        <Text key={i} style={{ color: "#9ACD32" }}>{part}</Text>
                                      ) : (
                                        <Text key={i}>{part}</Text>
                                      )
                                    )}
                                  </Text>
                                );
                              })()}

                              {/* Attached image */}
                              {msgForPreview.imageUrl && (
                                <Image
                                  source={{ uri: msgForPreview.imageUrl }}
                                  style={{ width: "100%", height: 160, borderRadius: 12, marginBottom: 16 }}
                                  contentFit="cover"
                                />
                              )}

                              {/* Divider */}
                              <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginBottom: 14 }} />

                              {/* Action row: Reply + Go to Post */}
                              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                <TouchableOpacity
                                  onPress={() => {
                                    const replyBody = typeof msgForPreview.body === "string" ? msgForPreview.body : "";
                                    handleCloseNotifications();
                                    setReplyingTo({
                                      id: msgForPreview._id,
                                      userName: msgForPreview.userName || "User",
                                      body: replyBody,
                                    });
                                    // Scroll to chat input and focus it
                                    setTimeout(() => {
                                      if (scrollViewRef.current && chatInputYRef.current) {
                                        scrollViewRef.current.scrollTo({ y: Math.max(0, chatInputYRef.current - 80), animated: true });
                                      }
                                      setTimeout(() => chatInputRef.current?.focus(), 400);
                                    }, 150);
                                  }}
                                  activeOpacity={0.7}
                                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                                >
                                  <View
                                    style={{
                                      width: 32,
                                      height: 32,
                                      borderRadius: 16,
                                      backgroundColor: "#333",
                                      justifyContent: "center",
                                      alignItems: "center",
                                    }}
                                  >
                                    <Reply size={16} color="#999" />
                                  </View>
                                  <Text style={{ color: "#999", fontSize: 15, fontWeight: "600" }}>Reply</Text>
                                </TouchableOpacity>

                                {canViewInChat && (
                                  <TouchableOpacity
                                    onPress={() => {
                                      handleCloseNotifications();
                                      setTimeout(() => setScrollTargetId(expandedMessageId), 100);
                                    }}
                                    activeOpacity={0.7}
                                  >
                                    <Text style={{ color: "#9ACD32", fontSize: 15, fontWeight: "700" }}>Go to Post</Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            </>
                          )}
                        </View>
                      )}
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
