import { useMemo } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import {
  ArrowLeft,
  Clock3,
  Eye,
  Film,
  Heart,
  Lock,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "convex/_generated/api";
import ClipShareButton from "@/components/ClipShareButton";
import ContentPPVGate from "@/components/ContentPPVGate";
import VodPlaybackCard from "@/components/VodPlaybackCard";
import { useFAPIAuth } from "@/lib/fapi-auth";
import {
  formatCompactCount,
  formatCreationDate,
  formatDuration,
  getVideoPrice,
  getVideoThumbnailUrl,
  isPastShow,
} from "@/lib/video-utils";

function normalizeParam(param) {
  if (Array.isArray(param)) {
    return param[0];
  }

  return param;
}

export default function WatchVideoScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { sessionId } = useFAPIAuth();
  const videoId = normalizeParam(params.videoId);
  const wasJustPurchased = normalizeParam(params.purchased) === "true";

  const video = useQuery(
    api.videos.getVideo,
    videoId ? { videoId } : "skip",
  );

  const thumbnailUrl = useMemo(() => getVideoThumbnailUrl(video), [video]);
  const createdAt = useMemo(() => formatCreationDate(video?._creationTime), [video?._creationTime]);
  const gated = useMemo(
    () => Boolean(video && (video.visibility === "ppv" || isPastShow(video))),
    [video],
  );
  const gatePrice = useMemo(() => getVideoPrice(video), [video]);

  if (!videoId) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>Missing video</Text>
      </View>
    );
  }

  if (video === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#9ACD32" />
        <Text style={{ color: "#666", marginTop: 12 }}>Loading past show...</Text>
      </View>
    );
  }

  if (!video) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}>
        <Film size={42} color="#333" />
        <Text style={{ color: "#fff", fontSize: 22, fontWeight: "700", marginTop: 12 }}>
          Show not found
        </Text>
        <Text style={{ color: "#666", marginTop: 8, textAlign: "center" }}>
          This replay may have been removed or is still processing.
        </Text>
      </View>
    );
  }

  if (video.status !== "ready") {
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <View
            style={{
              paddingTop: insets.top + 12,
              paddingHorizontal: 20,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: "#111",
                justifyContent: "center",
                alignItems: "center",
                marginRight: 12,
              }}
            >
              <ArrowLeft size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: "#fff", fontSize: 22, fontWeight: "700", flex: 1 }} numberOfLines={1}>
              {video.title}
            </Text>
          </View>

          <View
            style={{
              marginTop: 32,
              marginHorizontal: 20,
              padding: 24,
              borderRadius: 16,
              backgroundColor: "#111",
              borderWidth: 1,
              borderColor: "#222",
              alignItems: "center",
            }}
          >
            <ActivityIndicator size="large" color="#9ACD32" />
            <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700", marginTop: 16 }}>
              {video.status === "processing" ? "Processing replay" : "Replay unavailable"}
            </Text>
            <Text style={{ color: "#666", marginTop: 8, textAlign: "center" }}>
              {video.status === "processing"
                ? "This set is still finishing up. Check back in a few minutes."
                : "This video is not ready for playback yet."}
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar style="light" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <View
          style={{
            paddingTop: insets.top + 12,
            paddingHorizontal: 20,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginRight: 12 }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: "#111",
                justifyContent: "center",
                alignItems: "center",
                marginRight: 12,
              }}
            >
              <ArrowLeft size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: "#fff", fontSize: 22, fontWeight: "700", flex: 1 }} numberOfLines={1}>
              Past Show
            </Text>
          </View>

          {video.provider === "mux" ? (
            <ClipShareButton
              videoId={video._id}
              streamTitle={video.title}
              sessionId={sessionId}
              provider={video.provider}
              isLive={false}
            />
          ) : null}
        </View>

        {wasJustPurchased ? (
          <View
            style={{
              marginHorizontal: 20,
              marginBottom: 16,
              backgroundColor: "rgba(20, 83, 45, 0.7)",
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "#166534",
              paddingHorizontal: 16,
              paddingVertical: 14,
            }}
          >
            <Text style={{ color: "#bbf7d0", fontWeight: "700" }}>
              Purchase successful. Your replay is now unlocked.
            </Text>
          </View>
        ) : null}

        {thumbnailUrl ? (
          <Image
            source={{ uri: thumbnailUrl }}
            contentFit="cover"
            style={{
              marginHorizontal: 20,
              marginBottom: 16,
              height: 180,
              borderRadius: 18,
            }}
          />
        ) : null}

        <View
          style={{
            marginHorizontal: 20,
            marginBottom: 20,
            backgroundColor: "#111",
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "#222",
            padding: 20,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: gated ? "rgba(154,205,50,0.18)" : "rgba(255,255,255,0.08)",
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              {gated ? (
                <Lock size={13} color="#9ACD32" />
              ) : (
                <Film size={13} color="#fff" />
              )}
              <Text
                style={{
                  color: gated ? "#9ACD32" : "#fff",
                  fontSize: 12,
                  fontWeight: "800",
                  marginLeft: 6,
                }}
              >
                {gated ? `$${(gatePrice / 100).toFixed(2)} replay` : "Replay available"}
              </Text>
            </View>
          </View>

          <Text style={{ color: "#fff", fontSize: 28, fontWeight: "800", lineHeight: 34 }}>
            {video.title}
          </Text>

          {video.description ? (
            <Text style={{ color: "#bbb", fontSize: 15, lineHeight: 22, marginTop: 12 }}>
              {video.description}
            </Text>
          ) : null}

          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 14, marginTop: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Eye size={15} color="#9ACD32" />
              <Text style={{ color: "#9ACD32", marginLeft: 6 }}>
                {formatCompactCount(video.viewCount || 0)} views
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Heart size={15} color="#f87171" />
              <Text style={{ color: "#f87171", marginLeft: 6 }}>
                {formatCompactCount(video.heartCount || 0)} hearts
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Clock3 size={15} color="#999" />
              <Text style={{ color: "#999", marginLeft: 6 }}>
                {formatDuration(video.duration || 0)}
              </Text>
            </View>
            {createdAt ? (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Film size={15} color="#777" />
                <Text style={{ color: "#777", marginLeft: 6 }}>
                  {createdAt}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {gated ? (
          <ContentPPVGate
            videoId={video._id}
            title={video.title}
            price={gatePrice}
            videoHeight={240}
            onRequireSignIn={() => router.push("/sign-in")}
            purchaseLabel="Unlock Replay"
            valueProp="Access this archived set with the same bundled entitlement rules as web."
            footerText="One-time purchase. Watch this replay anytime after checkout."
            badgeLabel="PAST SHOW"
            webFallbackPath={`/watch/${video._id}`}
            redirectPath={`watch/${video._id}?purchased=true`}
          >
            <VodPlaybackCard video={video} sessionId={sessionId} />
          </ContentPPVGate>
        ) : (
          <VodPlaybackCard video={video} sessionId={sessionId} />
        )}
      </ScrollView>
    </View>
  );
}
