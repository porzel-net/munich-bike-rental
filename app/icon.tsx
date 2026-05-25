import { ImageResponse } from "next/og";

import { siteConfig } from "../lib/site";

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
          background: "linear-gradient(135deg, #111111 0%, #2740a8 100%)",
          color: "#fff",
          borderRadius: "8px",
          fontSize: "20px",
          fontWeight: 800,
          lineHeight: 1,
        }}
      >
        {siteConfig.name.charAt(0)}
      </div>
    ),
    size
  );
}
