import { useContext, useEffect, useMemo, useRef } from "react";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useConvexAuth, useQuery } from "convex/react";
import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Clock3, Eye, Film, Heart, Lock, Play } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "convex/_generated/api";
import { useFAPIAuth } from "@/lib/fapi-auth";
import {
  formatCompactCount,
  formatCreationDate,
  formatDuration,
  getVideoPrice,
  getVideoThumbnailUrl,
} from "@/lib/video-utils";
import { ScrollToTopContext } from "./_layout";

const PLACEHOLDER_GRADIENTS = [
  ["#E91E63", "#673AB7", "#2196F3"],
  ["#FF9800", "#F44336", "#E91E63"],
  ["#4CAF50", "#00BCD4", "#3F51B5"],
  ["#9C27B0", "#E91E63", "#FF5722"],
];

function PastShowCard({
  video,
  gradientColors,
  userId,
  isConvexAuthenticated,
  isAdmin,
  isVIP,
  onPress,
}) {
  const hasEntitlement = useQuery(
    api.entitlements.hasBundledEntitlement,
    isConvexAuthenticated && userId ? { userId, videoId: video._id } : "skip",
  );

  const hasAccess = Boolean(hasEntitlement || isAdmin || isVIP);
  const thumbnailUrl = getVideoThumbnailUrl(video);
  const price = getVideoPrice(video);
  const createdAt = formatCreationDate(video._creationTime);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={{
        marginHorizontal: 20,
        marginBottom: 16,
        backgroundColor: "#1a1a1a",
        borderRadius: 16,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "#222",
      }}
    >
      <View
        style={{
          height: 190,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#0a0a0a",
        }}
      >
        {thumbnailUrl ? (
          <Image
            source={{ uri: thumbnailUrl }}
            contentFit="cover"
            style={{ width: "100%", height: "100%" }}
          />
        ) : (
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              justifyContent: "center",
              alignItems: "center",
            }}
          />
        )}

        <View
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            backgroundColor: hasAccess ? "#9ACD32" : "rgba(0,0,0,0.75)",
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 5,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          {hasAccess ? (
            <Heart size={13} color="#000" fill="#000" />
          ) : (
            <Lock size={13} color="#9ACD32" />
          )}
          <Text
            style={{
              color: hasAccess ? "#000" : "#9ACD32",
              fontSize: 12,
              fontWeight: "800",
            }}
          >
            {hasAccess ? "Owned" : `$${(price / 100).toFixed(2)}`}
          </Text>
        </View>

        <View
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            backgroundColor: "rgba(0,0,0,0.65)",
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 5,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Clock3 size={13} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>
            {formatDuration(video.duration || 0)}
          </Text>
        </View>

        <View
          style={{
            position: "absolute",
            width: 58,
            height: 58,
            borderRadius: 29,
            backgroundColor: "rgba(0,0,0,0.55)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Play size={24} color="#fff" fill="#fff" />
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
        <Text
          style={{
            color: "#fff",
            fontSize: 17,
            fontWeight: "700",
            marginBottom: 6,
          }}
          numberOfLines={2}
        >
          {video.title}
        </Text>

        {video.description ? (
          <Text style={{ color: "#999", fontSize: 13, marginBottom: 12 }} numberOfLines={2}>
            {video.description}
          </Text>
        ) : null}

        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Eye size={14} color="#9ACD32" />
            <Text style={{ color: "#9ACD32", fontSize: 13, marginLeft: 6 }}>
              {formatCompactCount(video.viewCount || 0)} views
            </Text>
          </View>

          {(video.heartCount || 0) > 0 ? (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Heart size={14} color="#f87171" />
              <Text style={{ color: "#f87171", fontSize: 13, marginLeft: 6 }}>
                {formatCompactCount(video.heartCount || 0)}
              </Text>
            </View>
          ) : null}

          {createdAt ? (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Clock3 size={14} color="#777" />
              <Text style={{ color: "#777", fontSize: 13, marginLeft: 6 }}>
                {createdAt}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function PastShowsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollViewRef = useRef(null);
  const scrollToTopSignal = useContext(ScrollToTopContext);
  const { userId } = useFAPIAuth();
  const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
  const pastShows = useQuery(api.videos.getPastShows, { limit: 24 });
  const isAdmin = useQuery(
    api.adminSettings.checkIsAdmin,
    isConvexAuthenticated ? {} : "skip",
  ) ?? false;
  const isVIP = useQuery(
    api.users.isCurrentUserVIP,
    isConvexAuthenticated ? {} : "skip",
  ) ?? false;

  const recordingCountLabel = useMemo(() => {
    if (!pastShows) {
      return "Loading previous live sessions...";
    }

    if (pastShows.length === 0) {
      return "No recordings available yet";
    }

    return `${pastShows.length} recordings from previous live sessions`;
  }, [pastShows]);

  useEffect(() => {
    if (scrollToTopSignal.route === "past-shows" && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: 0, animated: true });
    }
  }, [scrollToTopSignal.count, scrollToTopSignal.route]);

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginHorizontal: 20, marginBottom: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Film size={26} color="#9ACD32" />
            <Text
              style={{
                color: "#9ACD32",
                fontSize: 28,
                fontWeight: "700",
                marginLeft: 10,
              }}
            >
              Past Shows
            </Text>
          </View>
          <Text style={{ color: "#888", fontSize: 14 }}>{recordingCountLabel}</Text>
        </View>

        {pastShows === undefined ? (
          <View style={{ paddingTop: 80, alignItems: "center" }}>
            <ActivityIndicator size="large" color="#9ACD32" />
            <Text style={{ color: "#666", marginTop: 12 }}>Loading past shows...</Text>
          </View>
        ) : pastShows.length === 0 ? (
          <View
            style={{
              marginHorizontal: 20,
              marginTop: 24,
              padding: 24,
              backgroundColor: "#111",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#222",
              alignItems: "center",
            }}
          >
            <Film size={36} color="#333" />
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 12 }}>
              No past shows yet
            </Text>
            <Text style={{ color: "#666", fontSize: 14, textAlign: "center", marginTop: 8 }}>
              Check back after the next live session finishes processing.
            </Text>
          </View>
        ) : (
          pastShows.map((video, index) => (
            <PastShowCard
              key={video._id}
              video={video}
              gradientColors={PLACEHOLDER_GRADIENTS[index % PLACEHOLDER_GRADIENTS.length]}
              userId={userId}
              isConvexAuthenticated={isConvexAuthenticated}
              isAdmin={isAdmin}
              isVIP={isVIP}
              onPress={() => router.push(`/watch/${video._id}`)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}
