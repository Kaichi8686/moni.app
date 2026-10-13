import { ImageResponse } from "next/og";

export const alt = "シフトメイキング";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function ShiftCodeOpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(155deg, #e7eef6 0%, #f4f7fb 45%, #dceee9 100%)",
          color: "#14213d",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 28,
            fontWeight: 700,
            color: "#0d7377",
          }}
        >
          シフトメイキング
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 84,
              fontWeight: 900,
              letterSpacing: "-0.04em",
              lineHeight: 1.05,
            }}
          >
            シフト希望を教えて
          </div>
          <div style={{ fontSize: 34, color: "#3d4a66", lineHeight: 1.4 }}>
            ○入りたい　△入れる　×無理
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#0d7377", fontWeight: 700 }}>
          文化祭シフトをみんなで決めよう
        </div>
      </div>
    ),
    { ...size },
  );
}
