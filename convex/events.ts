import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// Get all events, sorted by searchedAt (newest first)
export const getAllEvents = query({
  handler: async (ctx) => {
    const events = await ctx.db
      .query("events")
      .withIndex("by_searchedAt")
      .order("desc")
      .collect();
    return events;
  },
});

// Get events for specific artists
export const getEventsByArtists = query({
  args: {
    artists: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const events = await ctx.db.query("events").collect();

    // Filter events for the specified artists (case-insensitive)
    const filteredEvents = events.filter(event =>
      args.artists.some(artist =>
        artist.toLowerCase() === event.artist.toLowerCase()
      )
    );

    // Sort by searchedAt (newest first)
    return filteredEvents.sort((a, b) => b.searchedAt - a.searchedAt);
  },
});

// Add a new event (or update if duplicate)
export const addEvent = mutation({
  args: {
    artist: v.string(),
    eventName: v.string(),
    venue: v.string(),
    location: v.string(),
    date: v.string(),
    time: v.string(),
    url: v.string(),
    description: v.string(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    // Normalize artist name for comparison
    const normalizedArtist = args.artist.toLowerCase().trim();

    // Get all events for this artist
    const allEvents = await ctx.db.query("events").collect();
    const artistEvents = allEvents.filter(
      event => event.artist.toLowerCase().trim() === normalizedArtist
    );

    // Helper function to normalize event names for comparison
    const normalizeEventName = (name: string) => {
      return name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ")
        .replace(/[^\w\s]/g, "");
    };

    // Helper function to normalize dates for comparison
    const normalizeDate = (date: string) => {
      return date.toLowerCase().trim().replace(/\s+/g, " ");
    };

    const normalizedNewEventName = normalizeEventName(args.eventName);
    const normalizedNewDate = normalizeDate(args.date);

    // Check for duplicates with fuzzy matching
    for (const existingEvent of artistEvents) {
      const normalizedExistingEventName = normalizeEventName(existingEvent.eventName);
      const normalizedExistingDate = normalizeDate(existingEvent.date);

      // Check if event names are very similar (same after normalization)
      const eventNameMatches = normalizedExistingEventName === normalizedNewEventName;

      // Check if dates are similar (same after normalization)
      const dateMatches = normalizedExistingDate === normalizedNewDate;

      if (eventNameMatches && dateMatches) {
        // Update the existing event with new searchedAt timestamp
        await ctx.db.patch(existingEvent._id, {
          venue: args.venue,
          location: args.location,
          time: args.time,
          url: args.url,
          description: args.description,
          model: args.model,
          searchedAt: Date.now(),
        });
        return existingEvent._id;
      }
    }

    // Insert new event if no duplicate found
    const eventId = await ctx.db.insert("events", {
      artist: args.artist,
      eventName: args.eventName,
      venue: args.venue,
      location: args.location,
      date: args.date,
      time: args.time,
      url: args.url,
      description: args.description,
      model: args.model,
      searchedAt: Date.now(),
    });
    return eventId;
  },
});

// Bulk add events
export const addEvents = mutation({
  args: {
    events: v.array(
      v.object({
        artist: v.string(),
        eventName: v.string(),
        venue: v.string(),
        location: v.string(),
        date: v.string(),
        time: v.string(),
        url: v.string(),
        description: v.string(),
      })
    ),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const eventIds = [];

    for (const event of args.events) {
      // Normalize artist name for comparison
      const normalizedArtist = event.artist.toLowerCase().trim();

      // Get all events for this artist
      const allEvents = await ctx.db.query("events").collect();
      const artistEvents = allEvents.filter(
        (e) => e.artist.toLowerCase().trim() === normalizedArtist
      );

      // Helper function to normalize event names for comparison
      const normalizeEventName = (name: string) => {
        return name
          .toLowerCase()
          .trim()
          .replace(/\s+/g, " ")
          .replace(/[^\w\s]/g, "");
      };

      // Helper function to normalize dates for comparison
      const normalizeDate = (date: string) => {
        return date.toLowerCase().trim().replace(/\s+/g, " ");
      };

      const normalizedNewEventName = normalizeEventName(event.eventName);
      const normalizedNewDate = normalizeDate(event.date);

      // Check for duplicates with fuzzy matching
      let isDuplicate = false;
      for (const existingEvent of artistEvents) {
        const normalizedExistingEventName = normalizeEventName(existingEvent.eventName);
        const normalizedExistingDate = normalizeDate(existingEvent.date);

        // Check if event names are very similar (same after normalization)
        const eventNameMatches = normalizedExistingEventName === normalizedNewEventName;

        // Check if dates are similar (same after normalization)
        const dateMatches = normalizedExistingDate === normalizedNewDate;

        if (eventNameMatches && dateMatches) {
          // Update the existing event with new searchedAt timestamp
          await ctx.db.patch(existingEvent._id, {
            venue: event.venue,
            location: event.location,
            time: event.time,
            url: event.url,
            description: event.description,
            model: args.model,
            searchedAt: Date.now(),
          });
          eventIds.push(existingEvent._id);
          isDuplicate = true;
          break;
        }
      }

      // Insert new event if no duplicate found
      if (!isDuplicate) {
        const eventId = await ctx.db.insert("events", {
          artist: event.artist,
          eventName: event.eventName,
          venue: event.venue,
          location: event.location,
          date: event.date,
          time: event.time,
          url: event.url,
          description: event.description,
          model: args.model,
          searchedAt: Date.now(),
        });
        eventIds.push(eventId);
      }
    }

    return eventIds;
  },
});

// Delete a specific event
export const deleteEvent = mutation({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.eventId);
    return { success: true };
  },
});

// Delete all events
export const deleteAllEvents = mutation({
  handler: async (ctx) => {
    const allEvents = await ctx.db.query("events").collect();

    for (const event of allEvents) {
      await ctx.db.delete(event._id);
    }

    return { deleted: allEvents.length };
  },
});

// Delete old events (older than 90 days)
export const cleanupOldEvents = mutation({
  handler: async (ctx) => {
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;

    const oldEvents = await ctx.db
      .query("events")
      .withIndex("by_searchedAt")
      .filter((q) => q.lt(q.field("searchedAt"), ninetyDaysAgo))
      .collect();

    for (const event of oldEvents) {
      await ctx.db.delete(event._id);
    }

    return { deleted: oldEvents.length };
  },
});
