import { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, Animated, TouchableOpacity } from "react-native";

const DOT_COLORS = [
  { base: "#E91E63", shimmer: "#d97706", alt: "#e11d48" },
  { base: "#2196F3", shimmer: "#c026d3", alt: "#7c3aed" },
  { base: "#00BCD4", shimmer: "#0284c7", alt: "#0d9488" },
  { base: "#4CAF50", shimmer: "#059669", alt: "#65a30d" },
  { base: "#8BC34A", shimmer: "#7c3aed", alt: "#c026d3" },
  { base: "#FFC107", shimmer: "#d97706", alt: "#eab308" },
  { base: "#FF9800", shimmer: "#e11d48", alt: "#ec4899" },
  { base: "#9C27B0", shimmer: "#4f46e5", alt: "#06b6d4" },
  { base: "#673AB7", shimmer: "#059669", alt: "#eab308" },
];

const TEXT_COLORS = [
  "#d97706", "#c026d3", "#0284c7", "#059669",
  "#7c3aed", "#e11d48", "#4f46e5", "#65a30d",
];

const DJSNEAK = ["d", "j", "s", "n", "e", "a", "k"];

function ShimmerDot({ colors, index }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [currentColor, setCurrentColor] = useState(colors.base);

  useEffect(() => {
    const shimmer = () => {
      const newColor = Math.random() < 0.6 ? colors.shimmer : colors.alt;
      setCurrentColor(newColor);

      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.15,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
      ]).start();

      setTimeout(() => setCurrentColor(colors.base), 1500);
    };

    // Staggered initial delay
    const initialDelay = Math.random() * 6000;
    const initialTimer = setTimeout(() => {
      shimmer();
      // Then repeat on interval
      const interval = setInterval(shimmer, 2000 + Math.random() * 4000);
      // Store for cleanup
      timerRef.current = interval;
    }, initialDelay);

    const timerRef = { current: null };

    return () => {
      clearTimeout(initialTimer);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [colors, scaleAnim]);

  return (
    <Animated.View
      style={{
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: currentColor,
        transform: [{ scale: scaleAnim }],
      }}
    />
  );
}

export default function LogoShimmer() {
  const [letterColors, setLetterColors] = useState({});
  const animTimerRef = useRef(null);
  const intervalRef = useRef(null);

  const animateText = useCallback(() => {
    let i = 0;
    const animate = () => {
      if (i >= DJSNEAK.length) {
        // Clear all after a short delay
        setTimeout(() => setLetterColors({}), 600);
        return;
      }

      const color = TEXT_COLORS[Math.floor(Math.random() * TEXT_COLORS.length)];
      setLetterColors((prev) => ({ ...prev, [i]: color }));

      const currentI = i;
      // Clear this letter after a while
      setTimeout(() => {
        setLetterColors((prev) => {
          const next = { ...prev };
          delete next[currentI];
          return next;
        });
      }, 600 + Math.random() * 400);

      i++;
      // Random delay: 50% fast, 50% slow
      const delay = Math.random() < 0.5
        ? 30 + Math.random() * 90
        : 250 + Math.random() * 350;
      animTimerRef.current = setTimeout(animate, delay);
    };

    animate();
  }, []);

  useEffect(() => {
    // Auto-trigger every 10-30 seconds
    const scheduleNext = () => {
      intervalRef.current = setTimeout(() => {
        animateText();
        scheduleNext();
      }, 10000 + Math.random() * 20000);
    };

    // First animation after a short delay
    const firstTimer = setTimeout(() => {
      animateText();
      scheduleNext();
    }, 2000);

    return () => {
      clearTimeout(firstTimer);
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
      if (intervalRef.current) clearTimeout(intervalRef.current);
    };
  }, [animateText]);

  return (
    <TouchableOpacity
      onPress={animateText}
      activeOpacity={0.8}
      style={{ flexDirection: "row", alignItems: "center" }}
    >
      {/* Disco ball grid */}
      <View style={{ marginRight: 12 }}>
        {[0, 1, 2].map((row) => (
          <View key={row} style={{ flexDirection: "row", gap: 4, marginBottom: row < 2 ? 4 : 0 }}>
            {[0, 1, 2].map((col) => {
              const idx = row * 3 + col;
              return <ShimmerDot key={idx} colors={DOT_COLORS[idx]} index={idx} />;
            })}
          </View>
        ))}
      </View>

      {/* djsneak text */}
      <Text style={{ fontSize: 28, fontWeight: "700" }}>
        {DJSNEAK.map((letter, index) => (
          <Text
            key={index}
            style={{
              color: letterColors[index] || "#fff",
            }}
          >
            {letter}
          </Text>
        ))}
      </Text>
    </TouchableOpacity>
  );
}
