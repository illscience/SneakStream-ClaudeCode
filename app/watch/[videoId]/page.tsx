"use client";

import { isMuxEnabled } from "@/lib/streamProvider";
import LivepeerWatchPage from "./LivepeerWatchPage";
import MuxWatchPage from "./MuxWatchPage";

export default function WatchPage(props: { params: Promise<{ videoId: string }> }) {
  return isMuxEnabled() ? <MuxWatchPage {...props} /> : <LivepeerWatchPage {...props} />;
}
