"use client";

type Props = {
  size?: "xs" | "sm" | "md" | "lg";
  corkOpen?: boolean;
  showPaper?: boolean;
  paperRising?: boolean;
  className?: string;
};

const SIZE = {
  xs: "h-11 w-7",
  sm: "h-[4.25rem] w-10",
  md: "h-40 w-[5.5rem]",
  lg: "h-56 w-32",
} as const;

/** Cartoon glass bottle with thick outlines — Duolingo toy feel */
export function BottleVisual({
  size = "md",
  corkOpen = false,
  showPaper = true,
  paperRising = false,
  className = "",
}: Props) {
  return (
    <div className={`relative ${SIZE[size]} ${className}`} aria-hidden>
      {/* Cork */}
      <div
        className="absolute left-1/2 z-40 w-[48%] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        style={{
          top: corkOpen ? "-34%" : "-2%",
          transform: `translateX(-50%) ${corkOpen ? "rotate(-28deg) translateX(-40%)" : ""}`,
        }}
      >
        <div
          className="mx-auto min-h-[0.85rem] w-full rounded-t-[0.55rem] rounded-b-[0.2rem] border-[2.5px] border-[#8B5A2B]/35"
          style={{
            height: size === "xs" || size === "sm" ? "22%" : "18%",
            background: "linear-gradient(180deg, #E8B86D 0%, #C4842D 55%, #A66A1C 100%)",
            boxShadow: "0 3px 0 #8B5A2B55",
          }}
        />
      </div>

      {/* Neck */}
      <div
        className="absolute left-1/2 top-[8%] z-20 h-[16%] w-[38%] -translate-x-1/2 rounded-t-[0.65rem] border-[2.5px] border-[#4FA8C8]/55"
        style={{
          background: "linear-gradient(90deg, #7ED6F0 0%, #C9F0FF 45%, #5BC4E8 100%)",
          boxShadow: "inset 0 0 8px rgba(255,255,255,0.55)",
        }}
      />

      {/* Body */}
      <div
        className="absolute inset-x-[6%] bottom-0 top-[20%] overflow-hidden rounded-[45%_45%_40%_40%/16%_16%_48%_48%] border-[3px] border-[#3A9FC0]/55"
        style={{
          background:
            "linear-gradient(125deg, rgba(126,214,240,0.75) 0%, rgba(91,196,232,0.55) 45%, rgba(180,235,255,0.8) 100%)",
          boxShadow: "0 8px 0 rgba(30,120,150,0.18), inset 0 4px 10px rgba(255,255,255,0.45)",
        }}
      >
        <div className="absolute left-[14%] top-[12%] h-[42%] w-[16%] rounded-full bg-white/50" />

        {showPaper ? (
          <div
            className="absolute left-1/2 transition-all duration-500 ease-out"
            style={{
              bottom: paperRising ? "38%" : "20%",
              width: paperRising ? "62%" : "42%",
              height: paperRising ? "46%" : "44%",
              transform: `translateX(-50%) rotate(${paperRising ? 0 : -10}deg)`,
            }}
          >
            <div
              className="h-full w-full rounded-[0.35rem] border-2 border-[#D4A574]/70"
              style={{
                background: paperRising
                  ? "linear-gradient(180deg, #FFF8E7 0%, #FFE8B8 100%)"
                  : "repeating-linear-gradient(90deg, #FFF3D1 0 4px, #F5D9A0 4px 7px)",
                boxShadow: "0 3px 0 rgba(180,120,40,0.25)",
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
