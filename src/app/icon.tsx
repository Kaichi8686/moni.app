import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
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
          background: "linear-gradient(135deg, #6366f1 0%, #0ea5e9 100%)",
          color: "white",
          fontSize: 112,
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
