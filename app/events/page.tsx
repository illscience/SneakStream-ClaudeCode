"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Calendar, MapPin, Clock, ExternalLink, Music, Sparkles, RefreshCw, Users } from "lucide-react";
import Header from "../components/Header";

interface Event {
  artist: string;
  eventName: string;
  venue: string;
  location: string;
  date: string;
  time: string;
  url: string;
  description: string;
  rawResponse?: boolean;
}

const DEFAULT_ARTISTS = [
  "DJ SNEAK",
  "MARK FARINA",
  "DJ HEATHER",
  "DERRICK CARTER",
  "DOC MARTIN",
];

const AVAILABLE_MODELS = [
  { id: "claude-sonnet-4-5-20250929", name: "Claude Sonnet 4.5" },
  { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
  { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet" },
  { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet v2" },
  { id: "claude-3-5-sonnet-20240620", name: "Claude 3.5 Sonnet" },
  { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku" },
  { id: "claude-3-opus-20240229", name: "Claude 3 Opus" },
  { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku" },
];

export default function EventsPage() {
  const router = useRouter();
  const [selectedArtists, setSelectedArtists] = useState<string[]>(DEFAULT_ARTISTS);
  const [customArtist, setCustomArtist] = useState("");
  const [selectedModel, setSelectedModel] = useState("claude-sonnet-4-20250514");
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Search for events
  const searchEvents = async () => {
    if (selectedArtists.length === 0) {
      setError("Please select at least one artist");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/events/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          artists: selectedArtists,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to search events");
      }

      const data = await response.json();
      setEvents(data.events || []);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search events");
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Search on mount and when model changes
  useEffect(() => {
    if (selectedArtists.length > 0) {
      searchEvents();
    }
  }, [selectedModel]);

  const toggleArtist = (artist: string) => {
    setSelectedArtists((prev) =>
      prev.includes(artist)
        ? prev.filter((a) => a !== artist)
        : [...prev, artist]
    );
  };

  const addCustomArtist = () => {
    if (customArtist.trim() && !selectedArtists.includes(customArtist.trim().toUpperCase())) {
      setSelectedArtists([...selectedArtists, customArtist.trim().toUpperCase()]);
      setCustomArtist("");
    }
  };

  const removeArtist = (artist: string) => {
    setSelectedArtists(selectedArtists.filter((a) => a !== artist));
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Header title="UPCOMING EVENTS" />

      <main className="pt-24 pb-16 px-4">
        {/* Search Controls */}
        <div className="mb-8 bg-gradient-to-br from-pink-200 via-pink-300 to-pink-200 rounded-3xl p-8">
          {/* Model Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-black/60 mb-2">
              AI Model
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full px-4 py-3 bg-white/90 border-0 rounded-full text-black font-medium focus:outline-none focus:bg-white transition-all"
            >
              {AVAILABLE_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>

          {/* Artist Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-black/60 mb-3">
              Select Artists ({selectedArtists.length} selected)
            </label>
            <div className="flex flex-wrap gap-3 mb-4">
              {DEFAULT_ARTISTS.map((artist) => (
                <button
                  key={artist}
                  onClick={() => toggleArtist(artist)}
                  className={`px-6 py-3 rounded-full font-medium transition-all ${
                    selectedArtists.includes(artist)
                      ? "bg-lime-400 text-black hover:bg-lime-300"
                      : "bg-white/90 text-black hover:bg-white"
                  }`}
                >
                  {artist}
                </button>
              ))}
            </div>

            {/* Custom Artist Input */}
            <div className="flex gap-3">
              <input
                type="text"
                value={customArtist}
                onChange={(e) => setCustomArtist(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && addCustomArtist()}
                placeholder="Add custom artist..."
                className="flex-1 px-4 py-3 bg-white/90 rounded-full text-black placeholder-black/40 focus:outline-none focus:bg-white transition-all"
              />
              <button
                onClick={addCustomArtist}
                className="px-6 py-3 bg-white/90 hover:bg-white rounded-full font-medium transition-colors text-black"
              >
                Add
              </button>
            </div>

            {/* Selected Artists Tags */}
            {selectedArtists.some((a) => !DEFAULT_ARTISTS.includes(a)) && (
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedArtists
                  .filter((a) => !DEFAULT_ARTISTS.includes(a))
                  .map((artist) => (
                    <div
                      key={artist}
                      className="px-4 py-2 bg-white/90 rounded-full text-sm flex items-center gap-2 text-black"
                    >
                      <span>{artist}</span>
                      <button
                        onClick={() => removeArtist(artist)}
                        className="text-black/60 hover:text-black transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Search Button */}
          <button
            onClick={searchEvents}
            disabled={loading || selectedArtists.length === 0}
            className="w-full py-4 bg-lime-400 text-black rounded-full font-bold hover:bg-lime-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Searching Events...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Search Events
              </>
            )}
          </button>

          {lastUpdated && (
            <p className="text-center text-xs text-black/40 mt-3">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-6 bg-gradient-to-br from-red-200 to-red-300 rounded-3xl text-red-900 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Events Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-80 bg-gradient-to-br from-pink-200 to-pink-300 rounded-3xl animate-pulse"
              />
            ))}
          </div>
        ) : events.length > 0 ? (
          <div className="space-y-8">
            {/* Group events by artist */}
            {selectedArtists.map((artist) => {
              const artistEvents = events.filter(
                (e) => e.artist.toUpperCase() === artist.toUpperCase()
              );
              if (artistEvents.length === 0) return null;

              return (
                <div key={artist} className="space-y-4">
                  <h2 className="text-3xl font-bold text-white">
                    {artist}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {artistEvents.map((event, idx) => (
                      <div
                        key={idx}
                        className="bg-gradient-to-br from-pink-200 to-pink-300 rounded-3xl p-6 overflow-hidden"
                      >
                        {event.rawResponse ? (
                          <div className="prose max-w-none">
                            <p className="text-sm text-black/60 whitespace-pre-wrap">
                              {event.description}
                            </p>
                          </div>
                        ) : (
                          <>
                            <h3 className="text-xl font-bold mb-4 text-black">
                              {event.eventName}
                            </h3>

                            <div className="space-y-3 mb-4">
                              {event.venue && (
                                <div className="flex items-start gap-2 text-black/80 text-sm">
                                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                  <div>
                                    <p className="font-medium">{event.venue}</p>
                                    {event.location && (
                                      <p className="text-black/60">
                                        {event.location}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}

                              {event.date && (
                                <div className="flex items-center gap-2 text-black/80 text-sm">
                                  <Calendar className="w-4 h-4 flex-shrink-0" />
                                  <span className="font-medium">{event.date}</span>
                                </div>
                              )}

                              {event.time && (
                                <div className="flex items-center gap-2 text-black/80 text-sm">
                                  <Clock className="w-4 h-4 flex-shrink-0" />
                                  <span className="font-medium">{event.time}</span>
                                </div>
                              )}
                            </div>

                            {event.description && (
                              <p className="text-sm text-black/60 mb-4 line-clamp-2">
                                {event.description}
                              </p>
                            )}

                            {event.url && (
                              <a
                                href={event.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-6 py-3 bg-lime-400 text-black rounded-full font-bold hover:bg-lime-300 transition-colors"
                              >
                                More Info
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Events not matching selected artists */}
            {events.filter(
              (e) =>
                !selectedArtists.some(
                  (a) => a.toUpperCase() === e.artist.toUpperCase()
                )
            ).length > 0 && (
              <div className="space-y-4">
                <h2 className="text-3xl font-bold text-white">
                  Other Results
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {events
                    .filter(
                      (e) =>
                        !selectedArtists.some(
                          (a) => a.toUpperCase() === e.artist.toUpperCase()
                        )
                    )
                    .map((event, idx) => (
                      <div
                        key={idx}
                        className="bg-gradient-to-br from-pink-200 to-pink-300 rounded-3xl p-6 overflow-hidden"
                      >
                        <div className="text-xs text-lime-600 font-bold mb-2 uppercase">
                          {event.artist}
                        </div>
                        <h3 className="text-xl font-bold mb-4 text-black">
                          {event.eventName}
                        </h3>

                        <div className="space-y-3 mb-4">
                          {event.venue && (
                            <div className="flex items-start gap-2 text-black/80 text-sm">
                              <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="font-medium">{event.venue}</p>
                                {event.location && (
                                  <p className="text-black/60">
                                    {event.location}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {event.date && (
                            <div className="flex items-center gap-2 text-black/80 text-sm">
                              <Calendar className="w-4 h-4 flex-shrink-0" />
                              <span className="font-medium">{event.date}</span>
                            </div>
                          )}
                        </div>

                        {event.description && (
                          <p className="text-sm text-black/60 mb-4 line-clamp-2">
                            {event.description}
                          </p>
                        )}

                        {event.url && (
                          <a
                            href={event.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-lime-400 text-black rounded-full font-bold hover:bg-lime-300 transition-colors"
                          >
                            More Info
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="bg-gradient-to-br from-pink-200 to-pink-300 rounded-3xl p-12 inline-block">
              <Music className="w-16 h-16 text-black/40 mx-auto mb-4" />
              <p className="text-black/60 font-medium">
                {selectedArtists.length === 0
                  ? "Select artists to search for events"
                  : "No events found. Try searching with different artists or check back later!"}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
