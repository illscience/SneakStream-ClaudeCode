"use client";

import { isMuxEnabled } from "@/lib/streamProvider";
import LivepeerGoLivePage from "./LivepeerGoLivePage";
import MuxGoLivePage from "./MuxGoLivePage";

export default function GoLivePage() {
  return isMuxEnabled() ? <MuxGoLivePage /> : <LivepeerGoLivePage />;
}
