import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
  width: 32,
  height: 32,
};

export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: "22%",
          background:
            "radial-gradient(circle at 28% 24%, rgba(255,255,255,0.12) 0, rgba(255,255,255,0.04) 18%, transparent 42%), linear-gradient(135deg, #0b0f17 0%, #13213b 62%, #f2a873 140%)",
          color: "#fff",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "14%",
            borderRadius: "20%",
            border: "1.5px solid rgba(255,255,255,0.16)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: "15%",
            top: "18%",
            width: "18%",
            height: "18%",
            borderRadius: "999px",
            background: "#f2a873",
            boxShadow: "0 0 0 3px rgba(242,168,115,0.18)",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.04em",
            fontSize: "20px",
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: "-0.08em",
            textTransform: "uppercase",
            transform: "translateY(1px)",
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
