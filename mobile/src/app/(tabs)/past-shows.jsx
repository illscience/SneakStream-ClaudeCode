import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Eye, Film, Play, Clock, Lock } from "lucide-react-native";
import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useContext, useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { api } from "convex/_generated/api";
import { ScrollToTopContext } from "./_layout";

// Deterministic gradient colors from video ID hash
function getGradientColors(id) {
  const palettes = [
    ["#E91E63", "#673AB7", "#2196F3"],
    ["#FF9800", "#F44336", "#E91E63"],
    ["#4CAF50", "#00BCD4", "#3F51B5"],
    ["#9C27B0", "#E91E63", "#FF5722"],
    ["#009688", "#3F51B5", "#673AB7"],
    ["#FFC107", "#FF9800", "#F44336"],
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return palettes[Math.abs(hash) % palettes.length];
}

function formatDuration(seconds) {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatViewCount(count) {
  if (count == null) return "0";
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

function formatDate(timestamp) {
  const d = new Date(timestamp);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function PastShowsScreen() {
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef(null);
  const scrollToTopSignal = useContext(ScrollToTopContext);
  const router = useRouter();

  const recordings = useQuery(api.videos.getRecentRecordings);

  useEffect(() => {
    if (scrollToTopSignal.route === "past-shows" && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: 0, animated: true });
    }
  }, [scrollToTopSignal.count]);

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
          <Text style={{ color: "#888", fontSize: 14 }}>
            {recordings === undefined
              ? "Loading..."
              : recordings.length === 0
                ? "No past shows yet"
                : `${recordings.length} recording${recordings.length === 1 ? "" : "s"} from previous live sessions`}
          </Text>
        </View>

        {recordings === undefined ? (
          <View style={{ paddingTop: 40, alignItems: "center" }}>
            <ActivityIndicator size="large" color="#9ACD32" />
          </View>
        ) : recordings.length === 0 ? (
          <View style={{ paddingTop: 40, alignItems: "center" }}>
            <Film size={48} color="#333" />
            <Text style={{ color: "#555", fontSize: 15, marginTop: 12 }}>
              No past shows yet
            </Text>
          </View>
        ) : (
          recordings.map((video) => (
            <TouchableOpacity
              key={video._id}
              activeOpacity={0.8}
              onPress={() => router.push(`/watch/${video._id}`)}
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
              {/* Thumbnail or gradient fallback */}
              {video.thumbnailUrl ? (
                <View style={{ height: 170, position: "relative" }}>
                  <Image
                    source={{ uri: video.thumbnailUrl }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                  />
                  {/* Duration badge */}
                  <View
                    style={{
                      position: "absolute",
                      top: 12,
                      right: 12,
                      backgroundColor: "rgba(0,0,0,0.65)",
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>
                      {formatDuration(video.duration)}
                    </Text>
                  </View>
                  {/* PPV badge */}
                  {video.visibility === "ppv" && (
                    <View
                      style={{
                        position: "absolute",
                        top: 12,
                        left: 12,
                        backgroundColor: "rgba(154,205,50,0.9)",
                        borderRadius: 8,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        flexDirection: "row",
                        alignItems: "center",
                      }}
                    >
                      <Lock size={10} color="#000" />
                      <Text style={{ color: "#000", fontSize: 11, fontWeight: "700", marginLeft: 4 }}>
                        {video.price ? `$${(video.price / 100).toFixed(2)}` : "PPV"}
                      </Text>
                    </View>
                  )}
                  {/* Play icon center */}
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <View
                      style={{
                        width: 58,
                        height: 58,
                        borderRadius: 29,
                        backgroundColor: "rgba(0,0,0,0.45)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Play size={24} color="#fff" fill="#fff" />
                    </View>
                  </View>
                </View>
              ) : (
                <LinearGradient
                  colors={getGradientColors(video._id)}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    height: 170,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      position: "absolute",
                      top: 12,
                      right: 12,
                      backgroundColor: "rgba(0,0,0,0.65)",
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>
                      {formatDuration(video.duration)}
                    </Text>
                  </View>
                  {video.visibility === "ppv" && (
                    <View
                      style={{
                        position: "absolute",
                        top: 12,
                        left: 12,
                        backgroundColor: "rgba(154,205,50,0.9)",
                        borderRadius: 8,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        flexDirection: "row",
                        alignItems: "center",
                      }}
                    >
                      <Lock size={10} color="#000" />
                      <Text style={{ color: "#000", fontSize: 11, fontWeight: "700", marginLeft: 4 }}>
                        {video.price ? `$${(video.price / 100).toFixed(2)}` : "PPV"}
                      </Text>
                    </View>
                  )}
                  <View
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: 29,
                      backgroundColor: "rgba(0,0,0,0.45)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Play size={24} color="#fff" fill="#fff" />
                  </View>
                </LinearGradient>
              )}

              <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 17,
                    fontWeight: "700",
                    marginBottom: 10,
                  }}
                  numberOfLines={2}
                >
                  {video.title}
                </Text>

                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                  <Eye size={14} color="#9ACD32" />
                  <Text style={{ color: "#9ACD32", fontSize: 13, marginLeft: 6 }}>
                    {formatViewCount(video.viewCount)} views
                  </Text>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Clock size={14} color="#777" />
                  <Text style={{ color: "#777", fontSize: 13, marginLeft: 6 }}>
                    {formatDate(video._creationTime)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}
