import { Tabs } from "expo-router";
import { Film, Radio } from "lucide-react-native";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const tabBarBottomPadding = Platform.OS === "ios" ? Math.max(insets.bottom, 8) : 8;
  const tabBarHeight = Platform.OS === "ios" ? 56 + tabBarBottomPadding : 64;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#9ACD32",
        tabBarInactiveTintColor: "#666",
        tabBarStyle: {
          backgroundColor: "#000",
          borderTopColor: "#1a1a1a",
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingTop: 8,
          paddingBottom: tabBarBottomPadding,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Now Playing",
          tabBarIcon: ({ color, size }) => (
            <Radio color={color} size={size ?? 20} />
          ),
        }}
      />
      <Tabs.Screen
        name="past-shows"
        options={{
          title: "Past Shows",
          tabBarIcon: ({ color, size }) => (
            <Film color={color} size={size ?? 20} />
          ),
        }}
      />
    </Tabs>
  );
}
