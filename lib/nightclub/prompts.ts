const sunglassesStyles = [
  "holographic aviators",
  "mirrored wraparound shades",
  "chrome cat-eye sunglasses",
  "ultra-wide neon visor glasses",
  "sleek angular acetate sunglasses",
  "translucent pastel rimless shades",
];

const animalDescriptors = [
  "charismatic",
  "glowing",
  "iridescent",
  "cybernetic",
  "celestial",
  "glam rock",
];

const animals = [
  "red panda",
  "snow leopard",
  "golden retriever",
  "flamingo",
  "arctic fox",
  "dolphin",
  "toucan",
];

const animalFits = [
  "sequined bomber jacket",
  "chrome-trimmed leather biker vest",
  "prismatic bomber with LED patches",
  "iridescent satin jumpsuit",
  "synthetic fur coat with neon embroidery",
  "holographic tracksuit with shoulder pads",
];

const beachDescriptors = [
  "sun-kissed",
  "windswept",
  "roller-disco loving",
  "aerobics-champion",
  "surf-guitar obsessed",
  "retro-fitness icon",
];

const beachCharacters = [
  "lifeguard",
  "DJ",
  "roller skater",
  "surfer",
  "breakdancer",
  "fashion photographer",
  "synth-pop vocalist",
];

const beachFits = [
  "fluorescent windbreaker and high-cut shorts",
  "electric pink swimsuit with gold chains",
  "mesh crop top and shimmering leggings",
  "statement shoulder-pad blazer with board shorts",
  "color-blocked tracksuit with neon ankle warmers",
  "denim jacket covered in band patches and bold bikinis",
  "wet-look leather jacket with vibrant leotard",
];

const beachAccessories = [
  "boombox pulsing with synthwave",
  "glittering surfboard tucked under one arm",
  "retro camcorder capturing the crowd",
  "stack of cassette tapes and Walkman headphones",
  "roller skates leaving trails of neon sparks",
  "chrome keytar strapped across the torso",
];

const neonSettings = [
  "immersed in lavender and lime club lasers",
  "bathed in shimmering magenta strobes",
  "lit by electric cyan spotlights and fog",
  "surrounded by pulsating grid-style dance floor lights",
  "engulfed in ultraviolet haze and holographic projections",
  "backlit by neon palm silhouettes and glowing disco balls",
];

const photographyNotes = [
  "shot on 35mm film with cinematic grain",
  "ultra-detailed portrait lighting, f/1.8 lens",
  "hyperreal fashion editorial styling",
  "polished chrome reflections, studio lighting",
  "glossy magazine cover aesthetic",
  "dynamic motion blur with crisp subject focus",
];

const randomItem = <T,>(items: readonly T[]): T =>
  items[Math.floor(Math.random() * items.length)]!;

export interface NightclubAvatarPromptContext {
  alias?: string | null;
  categoryBias?: "animal" | "beach";
}

export interface NightclubAvatarPrompt {
  prompt: string;
  category: "animal" | "beach";
  vibe: string;
}

export const selectNightclubAvatarPrompt = ({
  alias,
  categoryBias,
}: NightclubAvatarPromptContext = {}): NightclubAvatarPrompt => {
  const category =
    categoryBias ??
    (Math.random() < 0.5 ? ("animal" as const) : ("beach" as const));

  if (category === "animal") {
    const speciesDescriptor = `${randomItem(animalDescriptors)} ${randomItem(
      animals
    )}`;
    const sunglasses = randomItem(sunglassesStyles);
    const fit = randomItem(animalFits);
    const setting = randomItem(neonSettings);
    const photography = randomItem(photographyNotes);

    const prompt = [
      `Ultra-detailed neon portrait of a ${speciesDescriptor} wearing ${sunglasses}`,
      `dressed in a ${fit}`,
      `${setting}`,
      "captured in a futuristic nightclub with lasers and fog",
      photography,
      "vibrant colors, lively expression, crisp focus, 8k, FAL diffusion",
    ].join(", ");

    return {
      prompt,
      category,
      vibe: `${speciesDescriptor} with ${sunglasses}`,
    };
  }

  const descriptor = randomItem(beachDescriptors);
  const character = randomItem(beachCharacters);
  const fit = randomItem(beachFits);
  const accessory = randomItem(beachAccessories);
  const setting = randomItem(neonSettings);
  const photography = randomItem(photographyNotes);

  const aliasFragment =
    alias && alias !== "Anonymous"
      ? `with a subtle nod to ${alias}'s signature flair`
      : "radiating confident charisma";

  const prompt = [
    `Vibrant 1980s Southern California nightclub fashion portrait of a ${descriptor} ${character}`,
    `wearing a ${fit}`,
    `rocking ${accessory}`,
    `${setting}`,
    aliasFragment,
    photography,
    "sunset glow meets neon club lighting, glossy editorial finish, FAL diffusion, shot mid-dance move",
  ].join(", ");

  return {
    prompt,
    category,
    vibe: `${descriptor} ${character} in neon beachwear`,
  };
};

const selfieStyles = [
  "candid group selfie on a neon-lit nightclub dance floor",
  "intimate moment captured at the DJ booth",
  "wild celebration selfie with friends",
  "cool mirror selfie in the club bathroom",
  "spontaneous dance floor photo",
  "glamorous VIP section group shot",
  "energetic crowd surfing moment",
];

const cameraAesthetics = [
  "shot on iPhone with flash",
  "DSLR party photography with professional lighting",
  "disposable camera flash aesthetic",
  "vintage digital camera with timestamp overlay",
  "professional event photography",
  "instant camera with soft flash",
  "retro point-and-shoot camera vibe",
];

const lightingScenarios = [
  "vibrant strobes and fog",
  "neon backlighting with purple and pink hues",
  "fog with crisscrossing laser beams",
  "disco ball sparkles and reflections",
  "UV blacklight glow",
  "colorful laser lights and smoke",
  "pulsating club lights with motion blur",
];

const selfieModds = [
  "energetic party atmosphere",
  "intimate moment",
  "wild celebration vibe",
  "cool and casual nightlife",
  "glamorous nightclub aesthetic",
  "authentic 1980s club vibes",
  "electric dance floor energy",
];

export const generatePolaroidSelfiePrompt = (): string => {
  const style = randomItem(selfieStyles);
  const camera = randomItem(cameraAesthetics);
  const lighting = randomItem(lightingScenarios);
  const mood = randomItem(selfieModds);

  const prompt = [
    style,
    "two friends dancing together",
    camera,
    lighting,
    mood,
    "authentic club photography, candid moment, vibrant colors",
  ].join(", ");

  return prompt;
};
