import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.CLAUDE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "CLAUDE_API_KEY not configured" },
        { status: 500 }
      );
    }

    const { artists, model } = await request.json();

    if (!artists || !Array.isArray(artists) || artists.length === 0) {
      return NextResponse.json(
        { error: "Artists array is required" },
        { status: 400 }
      );
    }

    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + 90);

    const artistList = artists.join(", ");
    const searchPrompt = `Search for upcoming live DJ events and performances for these artists: ${artistList}.

Find events happening between ${today.toLocaleDateString()} and ${futureDate.toLocaleDateString()}.

For each event you find, provide:
1. Artist name
2. Event name/title
3. Venue name
4. City and country
5. Date and time
6. Ticket/event URL
7. Brief description

Format your response as a JSON array of events. Each event should be an object with these fields: artist, eventName, venue, location, date, time, url, description.

Only include confirmed upcoming events with specific dates. If you can't find events for an artist, skip them.`;

    console.log("Searching for events with model:", model || "claude-3-5-sonnet-20241022");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model || "claude-3-5-sonnet-20241022",
        max_tokens: 4096,
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
          },
        ],
        messages: [
          {
            role: "user",
            content: searchPrompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Claude API error:", errorText);
      return NextResponse.json(
        { error: "Claude API request failed", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("Claude API response:", JSON.stringify(data, null, 2));

    // Handle tool use responses
    let responseText = "";
    if (data.content) {
      for (const content of data.content) {
        if (content.type === "text") {
          responseText += content.text;
        }
      }
    }

    if (!responseText) {
      responseText = "No events found or search failed.";
    }

    // Try to extract JSON from the response
    let events = [];
    try {
      // Look for JSON array in the response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        events = JSON.parse(jsonMatch[0]);
      } else {
        // If no JSON array found, return the raw text for client to parse
        events = [{
          artist: "Search Results",
          eventName: "Raw Response",
          venue: "",
          location: "",
          date: "",
          time: "",
          url: "",
          description: responseText,
          rawResponse: true
        }];
      }
    } catch (parseError) {
      console.error("Failed to parse events JSON:", parseError);
      // Return raw response if parsing fails
      events = [{
        artist: "Search Results",
        eventName: "Raw Response",
        venue: "",
        location: "",
        date: "",
        time: "",
        url: "",
        description: responseText,
        rawResponse: true
      }];
    }

    return NextResponse.json({
      success: true,
      events,
      model: model || "claude-3-5-sonnet-20241022",
      searchedArtists: artists,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Events search error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
