import { ImageResponse } from "next/og";

import { siteConfig } from "../lib/site";

export const runtime = "edge";

export const alt = `${siteConfig.name} - Rennrad-, Gravel- und Aero-Bike-Verleih in München`;
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background:
          "radial-gradient(circle at 18% 18%, rgba(65,105,225,0.35) 0, rgba(65,105,225,0.12) 26%, transparent 55%), linear-gradient(135deg, #0b0f17 0%, #12203a 54%, #f7b37f 100%)",
        color: "#fff",
        fontFamily: "Arial, Helvetica, sans-serif",
        position: "relative",
        padding: "64px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: "36px",
          padding: "56px",
          background: "rgba(8, 13, 24, 0.56)",
          boxShadow: "0 30px 90px rgba(0, 0, 0, 0.35)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "18px", maxWidth: "760px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              width: "fit-content",
              padding: "12px 18px",
              borderRadius: "999px",
              background: "rgba(255,255,255,0.12)",
              fontSize: "28px",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Munich Rental
          </div>
          <div
            style={{
              fontSize: "72px",
              lineHeight: 1.02,
              fontWeight: 800,
              letterSpacing: "-0.03em",
            }}
          >
            Bike-Verleih in München
          </div>
          <div
            style={{
              fontSize: "32px",
              lineHeight: 1.35,
              color: "rgba(255,255,255,0.88)",
              maxWidth: "680px",
            }}
          >
            Endurance-, Gravel- und Aero-Bikes, direkter Kontakt und klare Preise aus Maxvorstadt.
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: "24px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "24px" }}>
            <span style={{ color: "rgba(255,255,255,0.74)" }}>{siteConfig.url.replace("https://", "")}</span>
            <span>
              {siteConfig.address.streetAddress}, {siteConfig.address.postalCode} Muenchen
            </span>
          </div>
          <div
            style={{
              fontSize: "24px",
              padding: "16px 22px",
              borderRadius: "999px",
              background: "rgba(255,255,255,0.12)",
            }}
          >
            {siteConfig.phone}
          </div>
        </div>
      </div>
    </div>,
    size,
  );
}
