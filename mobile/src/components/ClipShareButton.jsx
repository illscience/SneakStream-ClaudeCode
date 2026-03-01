import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  ActivityIndicator,
  Alert,
  Share,
} from "react-native";
import { Image } from "expo-image";
import { Scissors, X, Download, Check, Share2, Copy, Instagram } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { File, Directory, Paths } from "expo-file-system";
import * as Clipboard from "expo-clipboard";

// Lazy-loaded native modules — these require a native rebuild (dev client)
// and will crash the module at import time if not available in the binary.
let MediaLibrary;
try { MediaLibrary = require("expo-media-library"); } catch {}
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { authorizedWebFetch, publicWebFetch } from "@/lib/web-api";

/**
 * State machine phases (mirrors web clip-share-button.tsx):
 * idle → creating → processing → ready | error
 */

export default function ClipShareButton({
  livestreamId,
  videoId,
  currentTime,
  streamTitle,
  sessionId,
  isLive,
  provider,
}) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState("idle"); // idle | creating | processing | ready | error
  const [clipAssetId, setClipAssetId] = useState(null);
  const [mp4Url, setMp4Url] = useState(null);
  const [playbackId, setPlaybackId] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showPanel, setShowPanel] = useState(false);
  const [copied, setCopied] = useState(false);
  const [igCopied, setIgCopied] = useState(false);
  const pollRef = useRef(null);

  // Hide for non-Mux VOD (live streams are always Mux)
  const isHidden = !isLive && provider && provider !== "mux";

  const igCaption = streamTitle
    ? `${streamTitle} @sneakhouseparty\nLive on www.sneakstream.xyz`
    : "@sneakhouseparty\nLive on www.sneakstream.xyz";

  const shareText = streamTitle
    ? `Check out this clip from ${streamTitle}! Live on www.sneakstream.xyz`
    : "Check out this clip! Live on www.sneakstream.xyz";

  const apiFetch = useCallback(({ path, init }) => {
    return sessionId
      ? authorizedWebFetch({ sessionId, path, init })
      : publicWebFetch({ path, init });
  }, [sessionId]);

  const createClip = useCallback(async () => {
    setPhase("creating");
    setShowPanel(true);
    setErrorMessage(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const payload = livestreamId
        ? { livestreamId }
        : { videoId, currentTime };

      const res = await apiFetch({
        path: "/api/clips",
        init: {
          method: "POST",
          body: JSON.stringify(payload),
        },
      });

      console.log("[Clip] POST response status:", res.status);

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let errorMsg = "Failed to create clip";
        try { errorMsg = JSON.parse(text)?.error || errorMsg; } catch {}
        console.log("[Clip] POST error:", res.status, text.slice(0, 200));
        setPhase("error");
        setErrorMessage(errorMsg);
        return;
      }

      const data = await res.json();
      setClipAssetId(data.clipAssetId);
      setPhase("processing");
    } catch (e) {
      console.error("[Clip] createClip error:", e?.message || e);
      setPhase("error");
      setErrorMessage("Network error");
    }
  }, [livestreamId, videoId, currentTime, apiFetch]);

  // Poll for clip readiness
  useEffect(() => {
    if (phase !== "processing" || !clipAssetId) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await apiFetch({
          path: `/api/clips?clipAssetId=${clipAssetId}`,
          init: { method: "GET" },
        });

        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;

        if (data.status === "ready" && data.mp4Url) {
          setMp4Url(data.mp4Url);
          setPlaybackId(data.playbackId);
          setPhase("ready");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (data.status === "failed") {
          setPhase("error");
          setErrorMessage("Clip encoding failed");
        }
      } catch {
        // Retry on next interval
      }
    };

    poll();
    pollRef.current = setInterval(poll, 3000);

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [phase, clipAssetId, apiFetch]);

  const downloadToCache = useCallback(async (url) => {
    console.log("[Clip] downloadToCache url:", url);
    const dest = new File(Paths.cache, `clip_${Date.now()}.mp4`);
    // Remove stale file from previous attempt
    if (dest.exists) dest.delete();
    await File.downloadFileAsync(url, dest);
    console.log("[Clip] download done:", dest.uri, "exists:", dest.exists);
    if (!dest.exists) {
      throw new Error("Download failed — file does not exist");
    }
    return dest.uri;
  }, []);

  const handleShare = useCallback(async () => {
    if (phase !== "ready" || !mp4Url) return;
    try {
      console.log("[Clip] handleShare — downloading clip...");
      const localUri = await downloadToCache(mp4Url);
      console.log("[Clip] handleShare — opening share sheet, uri:", localUri);
      await Share.share({
        url: localUri,
        message: shareText,
      });
      console.log("[Clip] handleShare — share sheet closed");
    } catch (e) {
      console.error("[Clip] handleShare error:", e?.message || e);
      if (e?.message?.includes("cancelled") || e?.message?.includes("dismiss")) return;
      Alert.alert("Share failed", e?.message || "Could not share the clip.");
    }
  }, [phase, mp4Url, shareText, downloadToCache]);

  const handleCopyLink = useCallback(async () => {
    if (phase !== "ready" || !mp4Url) return;
    await Clipboard.setStringAsync(`${shareText}\n${mp4Url}`);
    setCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopied(false), 2000);
  }, [phase, mp4Url, shareText]);

  const handleSave = useCallback(async () => {
    if (phase !== "ready" || !mp4Url) return;
    if (!MediaLibrary) {
      Alert.alert("Unavailable", "Saving requires a native rebuild.");
      return;
    }
    try {
      console.log("[Clip] handleSave — requesting permissions...");
      const { status } = await MediaLibrary.requestPermissionsAsync();
      console.log("[Clip] handleSave — permission status:", status);
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Allow camera roll access to save clips.",
        );
        return;
      }
      console.log("[Clip] handleSave — downloading clip...");
      const localUri = await downloadToCache(mp4Url);
      console.log("[Clip] handleSave — saving to library...");
      await MediaLibrary.saveToLibraryAsync(localUri);
      console.log("[Clip] handleSave — saved successfully");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved", "Clip saved to your camera roll!");
    } catch (e) {
      console.error("[Clip] handleSave error:", e?.message || e);
      Alert.alert("Save failed", e?.message || "Could not save the clip.");
    }
  }, [phase, mp4Url, downloadToCache]);

  const handleInstagram = useCallback(async () => {
    if (phase !== "ready" || !mp4Url) return;
    if (!MediaLibrary) {
      Alert.alert("Unavailable", "Instagram sharing requires a native rebuild.");
      return;
    }
    try {
      console.log("[Clip] handleInstagram — requesting permissions...");
      // Save to camera roll so user can pick it in Instagram
      const { status } = await MediaLibrary.requestPermissionsAsync();
      console.log("[Clip] handleInstagram — permission status:", status);
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Allow camera roll access to save clips for Instagram.",
        );
        return;
      }
      console.log("[Clip] handleInstagram — downloading clip...");
      const localUri = await downloadToCache(mp4Url);
      console.log("[Clip] handleInstagram — saving to library...");
      await MediaLibrary.saveToLibraryAsync(localUri);
      console.log("[Clip] handleInstagram — saved, copying caption...");
      // Copy caption to clipboard
      await Clipboard.setStringAsync(igCaption);
      setIgCopied(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => setIgCopied(false), 3000);
    } catch (e) {
      console.error("[Clip] handleInstagram error:", e?.message || e);
      Alert.alert("Failed", e?.message || "Could not prepare clip for Instagram.");
    }
  }, [phase, mp4Url, igCaption, downloadToCache]);

  const reset = useCallback(() => {
    setPhase("idle");
    setShowPanel(false);
    setClipAssetId(null);
    setMp4Url(null);
    setPlaybackId(null);
    setErrorMessage(null);
    setCopied(false);
    setIgCopied(false);
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  const handleButtonPress = useCallback(() => {
    if (phase === "idle") {
      createClip();
    } else {
      setShowPanel(true);
    }
  }, [phase, createClip]);

  if (isHidden) return null;

  return (
    <>
      {/* Clip button — icon-only circle */}
      <TouchableOpacity
        onPress={handleButtonPress}
        disabled={phase === "creating"}
        activeOpacity={0.7}
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: phase === "ready" ? "#9333ea" : "rgba(147,51,234,0.9)",
          justifyContent: "center",
          alignItems: "center",
          opacity: phase === "creating" ? 0.6 : 1,
        }}
      >
        {phase === "creating" ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Scissors size={20} color="#fff" />
        )}
      </TouchableOpacity>

      {/* Share panel modal */}
      <Modal
        visible={showPanel && phase !== "idle"}
        animationType="slide"
        transparent
        onRequestClose={reset}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }}>
          <Pressable onPress={reset} style={{ flex: 1 }} />
          <View
            style={{
              backgroundColor: "#111",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingBottom: insets.bottom + 20,
              paddingTop: 16,
              paddingHorizontal: 20,
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>
                {phase === "ready" ? "Clip Ready!" : "Creating Clip..."}
              </Text>
              <TouchableOpacity onPress={reset}>
                <X size={22} color="#999" />
              </TouchableOpacity>
            </View>

            {/* Loading state */}
            {(phase === "creating" || phase === "processing") && (
              <View style={{ alignItems: "center", paddingVertical: 24 }}>
                <ActivityIndicator size="large" color="#9333ea" />
                <Text
                  style={{
                    color: "#aaa",
                    fontSize: 14,
                    fontWeight: "500",
                    marginTop: 14,
                    textAlign: "center",
                  }}
                >
                  {phase === "creating"
                    ? "Grabbing the last 15 seconds..."
                    : "Encoding your clip..."}
                </Text>
              </View>
            )}

            {/* Ready state */}
            {phase === "ready" && playbackId && (
              <View>
                {/* Thumbnail preview */}
                <View
                  style={{
                    borderRadius: 12,
                    overflow: "hidden",
                    backgroundColor: "#222",
                    marginBottom: 16,
                    aspectRatio: 16 / 9,
                  }}
                >
                  <Image
                    source={{
                      uri: `https://image.mux.com/${playbackId}/thumbnail.jpg?time=7`,
                    }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                  />
                  <View
                    style={{
                      position: "absolute",
                      bottom: 6,
                      right: 6,
                      backgroundColor: "rgba(0,0,0,0.7)",
                      borderRadius: 4,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                    }}
                  >
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 10,
                        fontWeight: "600",
                      }}
                    >
                      0:15
                    </Text>
                  </View>
                </View>

                {/* Share options 2x2 grid */}
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  {/* Share */}
                  <TouchableOpacity
                    onPress={handleShare}
                    activeOpacity={0.7}
                    style={{
                      flex: 1,
                      minWidth: "45%",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      paddingVertical: 14,
                      backgroundColor: "#222",
                      borderRadius: 12,
                    }}
                  >
                    <Share2 size={18} color="#fff" />
                    <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
                      Share
                    </Text>
                  </TouchableOpacity>

                  {/* Copy Link */}
                  <TouchableOpacity
                    onPress={handleCopyLink}
                    activeOpacity={0.7}
                    style={{
                      flex: 1,
                      minWidth: "45%",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      paddingVertical: 14,
                      backgroundColor: "#222",
                      borderRadius: 12,
                    }}
                  >
                    {copied ? (
                      <Check size={18} color="#4ade80" />
                    ) : (
                      <Copy size={18} color="#fff" />
                    )}
                    <Text
                      style={{
                        color: copied ? "#4ade80" : "#fff",
                        fontSize: 14,
                        fontWeight: "600",
                      }}
                    >
                      {copied ? "Copied!" : "Copy Link"}
                    </Text>
                  </TouchableOpacity>

                  {/* Save */}
                  <TouchableOpacity
                    onPress={handleSave}
                    activeOpacity={0.7}
                    style={{
                      flex: 1,
                      minWidth: "45%",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      paddingVertical: 14,
                      backgroundColor: "#222",
                      borderRadius: 12,
                    }}
                  >
                    <Download size={18} color="#fff" />
                    <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
                      Save
                    </Text>
                  </TouchableOpacity>

                  {/* Instagram */}
                  <TouchableOpacity
                    onPress={handleInstagram}
                    activeOpacity={0.7}
                    style={{
                      flex: 1,
                      minWidth: "45%",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      paddingVertical: 14,
                      borderRadius: 12,
                      overflow: "hidden",
                      backgroundColor: "#c026d3",
                    }}
                  >
                    <Instagram size={18} color="#fff" />
                    <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
                      Instagram
                    </Text>
                  </TouchableOpacity>
                </View>

                {igCopied && (
                  <Text
                    style={{
                      color: "#4ade80",
                      fontSize: 12,
                      textAlign: "center",
                      marginTop: 10,
                    }}
                  >
                    Clip saved — caption with @sneakhouseparty copied!
                  </Text>
                )}
              </View>
            )}

            {/* Error state */}
            {phase === "error" && (
              <View style={{ paddingVertical: 16 }}>
                <Text
                  style={{
                    color: "#f87171",
                    fontSize: 14,
                    textAlign: "center",
                    marginBottom: 16,
                  }}
                >
                  {errorMessage || "Something went wrong"}
                </Text>
                <TouchableOpacity
                  onPress={reset}
                  activeOpacity={0.7}
                  style={{
                    paddingVertical: 12,
                    backgroundColor: "#222",
                    borderRadius: 12,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
                    Try Again
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}
