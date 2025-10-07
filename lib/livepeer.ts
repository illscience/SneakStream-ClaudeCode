const LIVEPEER_BASE_URL = "https://livepeer.studio/api";

function getLivepeerApiKey() {
  const key = process.env.LIVEPEER_STUDIO_API_KEY;
  if (!key) {
    throw new Error("Livepeer API key not configured. Set LIVEPEER_STUDIO_API_KEY in your environment.");
  }
  return key;
}

export async function requestLivepeerUpload(name: string) {
  const apiKey = getLivepeerApiKey();
  const response = await fetch(`${LIVEPEER_BASE_URL}/asset/request-upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Livepeer asset request failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

export async function getLivepeerAsset(assetId: string) {
  const apiKey = getLivepeerApiKey();
  const response = await fetch(`${LIVEPEER_BASE_URL}/asset/${assetId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Livepeer asset status failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

export async function createLivepeerStream(name: string) {
  const apiKey = getLivepeerApiKey();
  const response = await fetch(`${LIVEPEER_BASE_URL}/stream`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      profiles: [
        {
          name: "720p",
          bitrate: 2000000,
          fps: 30,
          width: 1280,
          height: 720,
        },
        {
          name: "480p",
          bitrate: 1000000,
          fps: 30,
          width: 854,
          height: 480,
        },
        {
          name: "360p",
          bitrate: 500000,
          fps: 30,
          width: 640,
          height: 360,
        },
      ],
      record: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Livepeer stream creation failed (${response.status}): ${errorText}`);
  }

  return response.json();
}
