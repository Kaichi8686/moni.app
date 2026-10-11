import { ImageResponse } from "next/og";

export const alt = "シフトメイキング";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function ShiftOpenGraphImage() {
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
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: "#0d7377",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 22,
            }}
          >
            ○
          </div>
          希望を集めて、自動で割り振る
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 92,
              fontWeight: 900,
              letterSpacing: "-0.04em",
              lineHeight: 1.05,
            }}
          >
            シフトメイキング
          </div>
          <div style={{ fontSize: 34, color: "#3d4a66", lineHeight: 1.4 }}>
            文化祭のシフトを、みんなの○△×から決める
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 14,
          }}
        >
          {["○ 入りたい", "△ 入れる", "× 無理"].map((label) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "14px 22px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.85)",
                border: "1px solid rgba(20,33,61,0.1)",
                fontSize: 26,
                fontWeight: 700,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
