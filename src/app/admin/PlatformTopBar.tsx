/**
 * Super Admin "you have left the workspace" cue — §3.2 Super Admin platform portal.
 * Amber PLATFORM MODE pill + tenant-count warning, plus the 5px diagonal hazard band
 * across the top of the content area.
 */
export default function PlatformTopBar({ tenantCount }: { tenantCount: number }) {
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 24px",
          background: "linear-gradient(170deg,#2b2924,#211f1a)",
          borderBottom: "1px solid #100f0d",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "3px 10px",
            borderRadius: 7,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "#211f1a",
            background: "var(--fw-amber)",
          }}
        >
          Platform Mode
        </span>
        <span style={{ fontSize: 12, color: "#a39d89" }}>
          You are outside a workspace — changes here affect all {tenantCount} tenant
          {tenantCount === 1 ? "" : "s"}
        </span>
      </div>
      <div
        aria-hidden="true"
        style={{
          height: 5,
          width: "100%",
          backgroundImage:
            "repeating-linear-gradient(135deg,#c9791d 0 12px,#8a4f13 12px 24px)",
        }}
      />
    </>
  );
}
