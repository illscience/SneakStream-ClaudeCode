"use client";

import { isMuxEnabled } from "@/lib/streamProvider";
import LivepeerUploadPage from "./LivepeerUploadPage";
import MuxUploadPage from "./MuxUploadPage";

export default function UploadPage() {
  return isMuxEnabled() ? <MuxUploadPage /> : <LivepeerUploadPage />;
}
