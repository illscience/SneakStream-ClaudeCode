import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useMutation, useQuery } from "convex/react";
import { Gavel, Timer, CreditCard, Plus, Square, ExternalLink } from "lucide-react-native";

import { api } from "convex/_generated/api";
import { useFAPIAuth } from "@/lib/fapi-auth";
import { authorizedWebFetch, getWebUrl } from "@/lib/web-api";

const INITIAL_BID_CENTS = 1000;

const formatDollars = (amountInCents) => `$${Math.round((amountInCents || 0) / 100)}`;

const parseJsonResponse = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

export default function AuctionPanel({
  livestreamId,
  streamStartedAt,
  onRequireSignIn,
}) {
  const { isSignedIn, sessionId, userId } = useFAPIAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showWebFallback, setShowWebFallback] = useState(false);
  const processedExpirySessionRef = useRef(null);

  const session = useQuery(
    api.bidding.getCurrentSession,
    livestreamId ? { livestreamId } : "skip",
  );
  const isAdmin = useQuery(
    api.adminSettings.checkIsAdmin,
    isSignedIn ? {} : "skip",
  ) ?? false;

  const placeBid = useMutation(api.bidding.placeBid);
  const openBidding = useMutation(api.bidding.openBidding);
  const closeBidding = useMutation(api.bidding.closeBidding);
  const processBiddingExpiry = useMutation(api.bidding.processBiddingExpiry);

  useEffect(() => {
    if (!session) {
      setCountdown(null);
      processedExpirySessionRef.current = null;
      return;
    }

    const updateCountdown = async () => {
      if (session.status === "open" && session.biddingEndsAt) {
        const remainingMs = Math.max(0, session.biddingEndsAt - Date.now());
        const seconds = Math.ceil(remainingMs / 1000);
        setCountdown(seconds);

        if (
          seconds === 0 &&
          session.holder &&
          processedExpirySessionRef.current !== session._id
        ) {
          processedExpirySessionRef.current = session._id;
          try {
            await processBiddingExpiry({ sessionId: session._id });
          } catch (error) {
            console.error("[AuctionPanel] processBiddingExpiry failed:", error);
          }
        }
        return;
      }

      if (session.status === "payment_pending" && session.paymentDeadline) {
        const remainingMs = Math.max(0, session.paymentDeadline - Date.now());
        setCountdown(Math.ceil(remainingMs / 1000));
        return;
      }

      setCountdown(null);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [
    session,
    processBiddingExpiry,
  ]);

  const handleOpenWebFallback = useCallback(async () => {
    try {
      await WebBrowser.openBrowserAsync(getWebUrl("/"));
    } catch (error) {
      console.error("[AuctionPanel] failed to open web fallback:", error);
    }
  }, []);

  const handleOpenBidding = useCallback(async () => {
    if (!streamStartedAt) {
      setErrorMessage("Stream start time unavailable");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setShowWebFallback(false);

    try {
      const videoTimestamp = Math.max(0, Math.floor((Date.now() - streamStartedAt) / 1000));
      await openBidding({ livestreamId, videoTimestamp });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to open bidding");
    } finally {
      setIsLoading(false);
    }
  }, [livestreamId, openBidding, streamStartedAt]);

  const handleCloseBidding = useCallback(async () => {
    if (!session) return;

    setIsLoading(true);
    setErrorMessage(null);
    setShowWebFallback(false);

    try {
      await closeBidding({ sessionId: session._id });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to close bidding");
    } finally {
      setIsLoading(false);
    }
  }, [closeBidding, session]);

  const handlePlaceBid = useCallback(async () => {
    if (!session) return;

    if (!isSignedIn) {
      onRequireSignIn?.();
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setShowWebFallback(false);

    try {
      await placeBid({ sessionId: session._id });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to place bid");
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn, onRequireSignIn, placeBid, session]);

  const handlePayNow = useCallback(async () => {
    if (!session) return;

    if (!isSignedIn) {
      onRequireSignIn?.();
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setShowWebFallback(false);

    try {
      const response = await authorizedWebFetch({
        sessionId,
        path: "/api/bidding/create-session",
        init: {
          method: "POST",
          body: JSON.stringify({
            sessionId: session._id,
            livestreamId: session.livestreamId,
          }),
        },
      });
      const data = await parseJsonResponse(response);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setShowWebFallback(true);
        }
        throw new Error(data?.error || "Failed to create checkout session");
      }

      if (!data?.url) {
        throw new Error("Missing checkout URL");
      }

      await WebBrowser.openBrowserAsync(data.url);
    } catch (error) {
      console.error("[AuctionPanel] pay flow failed:", error);
      setErrorMessage(error instanceof Error ? error.message : "Payment failed");
      if (error?.status === 401 || error?.status === 403 || error?.code === "MISSING_SESSION" || error?.code === "TOKEN_UNAVAILABLE") {
        setShowWebFallback(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn, onRequireSignIn, session, sessionId]);

  if (!livestreamId) {
    return null;
  }

  if (!session) {
    if (!isAdmin) return null;

    return (
      <View
        style={{
          marginBottom: 16,
          backgroundColor: "#22122c",
          borderColor: "#55306f",
          borderWidth: 1,
          borderRadius: 12,
          padding: 12,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: "#d946ef",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 10,
              }}
            >
              <Gavel size={16} color="#fff" />
            </View>
            <Text style={{ color: "#fff", fontWeight: "700", flexShrink: 1 }}>
              Live Auction - Buy This Record Now
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleOpenBidding}
            disabled={isLoading || !streamStartedAt}
            style={{
              backgroundColor: "#c4ff0e",
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 10,
              opacity: isLoading || !streamStartedAt ? 0.6 : 1,
              marginLeft: 10,
            }}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Plus size={14} color="#000" />
                <Text style={{ color: "#000", fontWeight: "700", marginLeft: 4 }}>Open</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        {errorMessage ? (
          <Text style={{ color: "#f87171", marginTop: 8, fontSize: 12 }}>{errorMessage}</Text>
        ) : null}
      </View>
    );
  }

  const isHolder = session.holder?.clerkId === userId;
  const isWinner = session.status === "payment_pending" && isHolder;
  const currentAmount = session.currentBid?.amount ?? INITIAL_BID_CENTS;
  const nextAmount = session.nextBidAmount ?? INITIAL_BID_CENTS;
  const showCountdown = session.status === "open" && session.holder && countdown !== null && countdown > 0;

  return (
    <View
      style={{
        marginBottom: 16,
        backgroundColor: "#22122c",
        borderColor: "#55306f",
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: "#d946ef",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 10,
            }}
          >
            <Gavel size={16} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>Live Auction - Add To Crate</Text>
            {session.status === "payment_pending" ? (
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                <CreditCard size={12} color="#c4ff0e" />
                <Text style={{ color: "#c4ff0e", marginLeft: 4, fontSize: 12 }}>
                  {isWinner ? "Ready to pay" : "Awaiting payment"}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={{ alignItems: "flex-end", marginLeft: 8 }}>
          <Text style={{ color: "#9ca3af", fontSize: 11 }}>
            {session.holder ? "Current Bid" : "Starting Bid"}
          </Text>
          <Text style={{ color: "#c4ff0e", fontSize: 22, fontWeight: "800" }}>
            {formatDollars(currentAmount)}
          </Text>
        </View>
      </View>

      {showCountdown ? (
        <View
          style={{
            marginBottom: 10,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#2f1d3a",
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 8,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Timer size={13} color="#9ca3af" />
            <Text style={{ color: "#9ca3af", fontSize: 12, marginLeft: 4 }}>Time remaining</Text>
          </View>
          <Text style={{ color: countdown <= 10 ? "#f87171" : "#fff", fontWeight: "800" }}>
            {countdown}s
          </Text>
        </View>
      ) : null}

      {session.holder ? (
        <Text style={{ color: "#d1d5db", fontSize: 13, marginBottom: 10 }}>
          <Text style={{ color: "#e879f9", fontWeight: "700" }}>{session.holder.alias}</Text> currently holds this track.
        </Text>
      ) : null}

      {session.status === "open" && isAdmin ? (
        <TouchableOpacity
          onPress={handleCloseBidding}
          disabled={isLoading}
          style={{
            backgroundColor: "#dc2626",
            borderRadius: 10,
            paddingVertical: 10,
            marginBottom: 10,
            alignItems: "center",
            opacity: isLoading ? 0.7 : 1,
          }}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Square size={14} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "700", marginLeft: 6 }}>Close Bidding</Text>
            </View>
          )}
        </TouchableOpacity>
      ) : null}

      {session.status === "open" ? (
        !isSignedIn ? (
          <TouchableOpacity
            onPress={() => onRequireSignIn?.()}
            style={{
              backgroundColor: "#9ACD32",
              borderRadius: 10,
              paddingVertical: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#000", fontWeight: "700" }}>Sign in to bid</Text>
          </TouchableOpacity>
        ) : isHolder ? (
          <View
            style={{
              backgroundColor: "#2f1d3a",
              borderRadius: 10,
              paddingVertical: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>
              You're holding the bid{countdown ? ` (${countdown}s)` : ""}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={handlePlaceBid}
            disabled={isLoading}
            style={{
              backgroundColor: session.holder ? "#d946ef" : "#c4ff0e",
              borderRadius: 10,
              paddingVertical: 10,
              alignItems: "center",
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={session.holder ? "#fff" : "#000"} />
            ) : (
              <Text style={{ color: session.holder ? "#fff" : "#000", fontWeight: "800" }}>
                {session.holder ? `Outbid for ${formatDollars(nextAmount)}` : "Claim for $10"}
              </Text>
            )}
          </TouchableOpacity>
        )
      ) : null}

      {session.status === "payment_pending" ? (
        isWinner ? (
          <TouchableOpacity
            onPress={handlePayNow}
            disabled={isLoading}
            style={{
              backgroundColor: "#c4ff0e",
              borderRadius: 10,
              paddingVertical: 10,
              alignItems: "center",
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <CreditCard size={14} color="#000" />
                <Text style={{ color: "#000", fontWeight: "800", marginLeft: 6 }}>
                  Pay Now - {formatDollars(currentAmount)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ) : (
          <View
            style={{
              backgroundColor: "#2f1d3a",
              borderRadius: 10,
              paddingVertical: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#d1d5db", fontWeight: "600" }}>
              Waiting for winner to complete payment...
            </Text>
          </View>
        )
      ) : null}

      {showWebFallback ? (
        <TouchableOpacity
          onPress={handleOpenWebFallback}
          style={{
            marginTop: 10,
            backgroundColor: "#111827",
            borderRadius: 10,
            paddingVertical: 9,
            alignItems: "center",
            borderColor: "#374151",
            borderWidth: 1,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <ExternalLink size={14} color="#9ACD32" />
            <Text style={{ color: "#9ACD32", marginLeft: 6, fontWeight: "700" }}>
              Open auction on web
            </Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {errorMessage ? (
        <Text style={{ color: "#f87171", marginTop: 10, fontSize: 12 }}>
          {errorMessage}
        </Text>
      ) : null}
    </View>
  );
}
