import { LinearGradient } from "expo-linear-gradient";
import { Eye, Film, Play, Clock } from "lucide-react-native";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PAST_SHOWS = [
  {
    id: "show-1",
    title: "Warehouse Set Vol. 1",
    duration: "1:12:34",
    views: "24.6K",
    date: "Jan 28, 2026",
    colors: ["#E91E63", "#673AB7", "#2196F3"],
  },
  {
    id: "show-2",
    title: "Sunrise Grooves Session",
    duration: "58:20",
    views: "18.1K",
    date: "Jan 21, 2026",
    colors: ["#FF9800", "#F44336", "#E91E63"],
  },
  {
    id: "show-3",
    title: "Chicago Basement Nights",
    duration: "1:34:09",
    views: "31.9K",
    date: "Jan 14, 2026",
    colors: ["#4CAF50", "#00BCD4", "#3F51B5"],
  },
  {
    id: "show-4",
    title: "Underground Classics Mix",
    duration: "47:55",
    views: "12.4K",
    date: "Jan 7, 2026",
    colors: ["#9C27B0", "#E91E63", "#FF5722"],
  },
  {
    id: "show-5",
    title: "Late Night Vinyl Session",
    duration: "1:05:42",
    views: "15.7K",
    date: "Dec 31, 2025",
    colors: ["#009688", "#3F51B5", "#673AB7"],
  },
  {
    id: "show-6",
    title: "New Year Warmup Set",
    duration: "39:11",
    views: "9.3K",
    date: "Dec 24, 2025",
    colors: ["#FFC107", "#FF9800", "#F44336"],
  },
];

export default function PastShowsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <ScrollView
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
            {PAST_SHOWS.length} recordings from previous live sessions
          </Text>
        </View>

        {PAST_SHOWS.map((show) => (
          <View
            key={show.id}
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
            <LinearGradient
              colors={show.colors}
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
                  {show.duration}
                </Text>
              </View>

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

            <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
              <Text
                style={{
                  color: "#fff",
                  fontSize: 17,
                  fontWeight: "700",
                  marginBottom: 10,
                }}
              >
                {show.title}
              </Text>

              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                <Eye size={14} color="#9ACD32" />
                <Text style={{ color: "#9ACD32", fontSize: 13, marginLeft: 6 }}>
                  {show.views} views
                </Text>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Clock size={14} color="#777" />
                <Text style={{ color: "#777", fontSize: 13, marginLeft: 6 }}>
                  {show.date}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
