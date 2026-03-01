import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { LogOut, User } from "lucide-react-native";
import { useFAPIAuth, clerkFetch } from "@/lib/fapi-auth";

const CLIENT_JWT_KEY = "__clerk_client_jwt";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isSignedIn, user, sessionId, refresh } = useFAPIAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = useCallback(async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      if (sessionId) {
        await clerkFetch(`/v1/client/sessions/${sessionId}/revoke`, {
          method: "POST",
        });
      }
    } catch (e) {
      console.warn("[SignOut] revoke failed:", e);
    }
    await SecureStore.deleteItemAsync(CLIENT_JWT_KEY);
    await refresh();
    setIsSigningOut(false);
  }, [isSigningOut, sessionId, refresh]);

  const displayName =
    user?.first_name && user?.last_name
      ? `${user.first_name} ${user.last_name}`
      : user?.first_name || user?.username || "User";

  const email = user?.email_addresses?.[0]?.email_address;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingHorizontal: 20,
          paddingBottom: 40,
        }}
      >
        {isSignedIn && user ? (
          <>
            {/* Avatar + Name */}
            <View style={{ alignItems: "center", marginBottom: 32 }}>
              {user.image_url ? (
                <Image
                  source={{ uri: user.image_url }}
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    marginBottom: 16,
                    borderWidth: 2,
                    borderColor: "#9ACD32",
                  }}
                />
              ) : (
                <View
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: "#1a1a1a",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                    borderWidth: 2,
                    borderColor: "#9ACD32",
                  }}
                >
                  <User color="#666" size={36} />
                </View>
              )}
              <Text
                style={{
                  color: "#fff",
                  fontSize: 22,
                  fontWeight: "700",
                }}
              >
                {displayName}
              </Text>
              {email ? (
                <Text style={{ color: "#888", fontSize: 14, marginTop: 4 }}>
                  {email}
                </Text>
              ) : null}
            </View>

            {/* Sign Out */}
            <TouchableOpacity
              onPress={handleSignOut}
              disabled={isSigningOut}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                height: 48,
                borderRadius: 12,
                backgroundColor: "#1a1a1a",
                borderWidth: 1,
                borderColor: "#333",
              }}
            >
              {isSigningOut ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <LogOut color="#DC2626" size={18} />
                  <Text style={{ color: "#DC2626", fontWeight: "600", fontSize: 15 }}>
                    Sign Out
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : (
          /* Signed out state */
          <View style={{ alignItems: "center", marginTop: 60 }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: "#1a1a1a",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <User color="#666" size={36} />
            </View>
            <Text
              style={{
                color: "#fff",
                fontSize: 18,
                fontWeight: "600",
                marginBottom: 8,
              }}
            >
              Not signed in
            </Text>
            <Text
              style={{
                color: "#888",
                fontSize: 14,
                textAlign: "center",
                marginBottom: 24,
              }}
            >
              Sign in to access your profile and join the chat.
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/sign-in")}
              style={{
                height: 48,
                paddingHorizontal: 32,
                borderRadius: 12,
                backgroundColor: "#9ACD32",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#000", fontWeight: "700", fontSize: 15 }}>
                Sign In
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
