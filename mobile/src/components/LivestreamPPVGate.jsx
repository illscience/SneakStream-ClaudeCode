import ContentPPVGate from "@/components/ContentPPVGate";

export default function LivestreamPPVGate({
  livestreamId,
  title,
  price = 999,
  videoHeight,
  children,
  onRequireSignIn,
}) {
  return (
    <ContentPPVGate
      livestreamId={livestreamId}
      title={title}
      price={price}
      videoHeight={videoHeight}
      onRequireSignIn={onRequireSignIn}
      purchaseLabel="Unlock Stream"
      valueProp="Access this live stream + recording"
      footerText="One-time purchase. Watch live and replay anytime."
      badgeLabel="LIVE"
      webFallbackPath="/"
    >
      {children}
    </ContentPPVGate>
  );
}
