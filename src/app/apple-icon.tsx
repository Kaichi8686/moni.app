import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
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
          background: "linear-gradient(135deg, #6366f1 0%, #0ea5e9 100%)",
          color: "white",
          fontSize: 104,
          fontWeight: 700,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        m
      </div>
    ),
    { ...size },
  );
}
