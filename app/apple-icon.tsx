import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          borderRadius: "28%",
          background:
            "radial-gradient(circle at 28% 24%, rgba(255,255,255,0.12) 0, rgba(255,255,255,0.04) 18%, transparent 42%), linear-gradient(135deg, #0b0f17 0%, #13213b 62%, #f2a873 140%)",
          color: "#fff",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "11%",
            borderRadius: "24%",
            border: "3px solid rgba(255,255,255,0.16)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: "14%",
            top: "16%",
            width: "12%",
            height: "12%",
            borderRadius: "999px",
            background: "#f2a873",
            boxShadow: "0 0 0 8px rgba(242,168,115,0.16)",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.05em",
            fontSize: "92px",
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: "-0.09em",
            textTransform: "uppercase",
            transform: "translateY(4px)",
            fontFamily: "Arial, Helvetica, sans-serif",
          }}
        >
          <span>M</span>
          <span style={{ color: "#f2a873" }}>R</span>
        </div>
      </div>
    ),
    size
  );
}
