const sunglassesStyles = [
  "holographic aviators",
  "mirrored wraparound shades",
  "chrome cat-eye sunglasses",
  "ultra-wide neon visor glasses",
  "sleek angular acetate sunglasses",
  "translucent pastel rimless shades",
  "geometric hexagonal frames",
  "gradient lens oversized shades",
  "retro round steampunk goggles",
  "crystalline faceted sunglasses",
  "metallic rose gold aviators",
  "prismatic shield visor",
];

const animalDescriptors = [
  "charismatic",
  "glowing",
  "iridescent",
  "cybernetic",
  "celestial",
  "glam rock",
  "ethereal",
  "cosmic",
  "luminescent",
  "electric",
  "holographic",
  "radiant",
];

const animals = [
  "red panda",
  "snow leopard",
  "golden retriever",
  "flamingo",
  "arctic fox",
  "dolphin",
  "toucan",
  "persian cat",
  "fennec fox",
  "peacock",
  "maine coon cat",
  "cockatoo",
  "lynx",
  "macaw",
  "husky",
  "serval cat",
  "otter",
  "kookaburra",
];

const animalFits = [
  "sequined bomber jacket",
  "chrome-trimmed leather biker vest",
  "prismatic bomber with LED patches",
  "iridescent satin jumpsuit",
  "synthetic fur coat with neon embroidery",
  "holographic tracksuit with shoulder pads",
  "metallic mesh tank top",
  "velvet studded vest",
  "laser-cut geometric jacket",
  "reflective windbreaker with glow tape",
];

const beachDescriptors = [
  "sun-kissed",
  "windswept",
  "roller-disco loving",
  "aerobics-champion",
  "surf-guitar obsessed",
  "retro-fitness icon",
  "neon-obsessed",
  "vintage glamour",
  "electric sunset chasing",
  "synth-wave dreaming",
  "chrome-loving",
  "palm tree cruising",
];

const beachCharacters = [
  "lifeguard",
  "DJ",
  "roller skater",
  "surfer",
  "breakdancer",
  "fashion photographer",
  "synth-pop vocalist",
  "skateboarder",
  "street artist",
  "music producer",
  "vintage shop owner",
  "record collector",
  "beach volleyball player",
  "motorcycle enthusiast",
  "graphic designer",
];

const beachFits = [
  "fluorescent windbreaker and high-cut shorts",
  "electric pink swimsuit with gold chains",
  "mesh crop top and shimmering leggings",
  "statement shoulder-pad blazer with board shorts",
  "color-blocked tracksuit with neon ankle warmers",
  "denim jacket covered in band patches and bold bikinis",
  "wet-look leather jacket with vibrant leotard",
  "zebra-print bodysuit with leg warmers",
  "satin bomber with graphic tee and ripped jeans",
  "tie-dye tank and neon board shorts",
  "metallic crop jacket and high-waisted bikini",
  "oversized blazer with nothing underneath and bike shorts",
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
