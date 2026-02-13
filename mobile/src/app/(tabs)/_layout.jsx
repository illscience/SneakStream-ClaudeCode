import { Tabs } from "expo-router";
import { Film, Radio, User } from "lucide-react-native";
import { Image, Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFAPIAuth } from "@/lib/fapi-auth";

function ProfileTabIcon({ color, focused }) {
  const { isSignedIn, user } = useFAPIAuth();

  if (isSignedIn && user?.image_url) {
    return (
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: 2,
          borderColor: focused ? "#9ACD32" : "transparent",
          overflow: "hidden",
        }}
      >
        <Image
          source={{ uri: user.image_url }}
          style={{ width: 24, height: 24, borderRadius: 12 }}
        />
      </View>
    );
  }

  return <User color={color} size={22} />;
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const tabBarBottomPadding = Platform.OS === "ios" ? Math.max(insets.bottom, 4) : 6;
  const tabBarHeight = Platform.OS === "ios" ? 48 + tabBarBottomPadding : 56;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#9ACD32",
        tabBarInactiveTintColor: "#555",
        tabBarStyle: {
          backgroundColor: "#0a0a0a",
          borderTopColor: "#1a1a1a",
          borderTopWidth: 0.5,
          height: tabBarHeight,
          paddingTop: 6,
          paddingBottom: tabBarBottomPadding,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Now Playing",
          tabBarIcon: ({ color }) => <Radio color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="past-shows"
        options={{
          title: "Past Shows",
          tabBarIcon: ({ color }) => <Film color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <ProfileTabIcon color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
