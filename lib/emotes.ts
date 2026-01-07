export type Emote = {
  id: string;
  src: string;
  alt: string;
};

export const EMOTES: Emote[] = [
  { id: "image0.png", src: "/emotes/image0.png", alt: "Emote 0" },
  { id: "image1.png", src: "/emotes/image1.png", alt: "Emote 1" },
  { id: "image2.png", src: "/emotes/image2.png", alt: "Emote 2" },
  { id: "image3.png", src: "/emotes/image3.png", alt: "Emote 3" },
  { id: "image4.png", src: "/emotes/image4.png", alt: "Emote 4" },
  { id: "image5.png", src: "/emotes/image5.png", alt: "Emote 5" },
  { id: "image6.png", src: "/emotes/image6.png", alt: "Emote 6" },
  { id: "image7.png", src: "/emotes/image7.png", alt: "Emote 7" },
  { id: "image8.png", src: "/emotes/image8.png", alt: "Emote 8" },
  { id: "image9.png", src: "/emotes/image9.png", alt: "Emote 9" },
  { id: "image10.png", src: "/emotes/image10.png", alt: "Emote 10" },
  { id: "image11.png", src: "/emotes/image11.png", alt: "Emote 11" },
  { id: "image12.png", src: "/emotes/image12.png", alt: "Emote 12" },
  { id: "image13.png", src: "/emotes/image13.png", alt: "Emote 13" },
  { id: "image14.png", src: "/emotes/image14.png", alt: "Emote 14" },
  { id: "image15.png", src: "/emotes/image15.png", alt: "Emote 15" },
  { id: "image16.png", src: "/emotes/image16.png", alt: "Emote 16" },
  { id: "image17.png", src: "/emotes/image17.png", alt: "Emote 17" },
  { id: "image18.png", src: "/emotes/image18.png", alt: "Emote 18" },
  { id: "image19.png", src: "/emotes/image19.png", alt: "Emote 19" },
  { id: "image20.png", src: "/emotes/image20.png", alt: "Emote 20" },
  { id: "image21.png", src: "/emotes/image21.png", alt: "Emote 21" },
  { id: "image22.png", src: "/emotes/image22.png", alt: "Emote 22" },
  { id: "image23.png", src: "/emotes/image23.png", alt: "Emote 23" },
  { id: "image24.png", src: "/emotes/image24.png", alt: "Emote 24" },
  { id: "image25.png", src: "/emotes/image25.png", alt: "Emote 25" },
  { id: "image26.png", src: "/emotes/image26.png", alt: "Emote 26" },
];

export const EMOTE_BY_ID = Object.fromEntries(
  EMOTES.map((emote) => [emote.id, emote])
) as Record<string, Emote>;
