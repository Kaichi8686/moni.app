"use client";

import { useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type Props = {
  url: string;
  duration: number;
  waveform: number[];
  isMine: boolean;
};

export function VoiceMessagePlayer({ url, duration, waveform, isMine }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const bars = waveform.length ? waveform : Array(40).fill(0.3);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      void audio.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className="flex w-48 items-center gap-3">
      <button
        type="button"
        onClick={togglePlay}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isMine ? "bg-violet-400" : "bg-violet-600"
        }`}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4 text-white" />
        ) : (
          <Play className="ml-0.5 h-4 w-4 text-white" />
        )}
      </button>
      <div className="flex h-8 flex-1 items-center gap-0.5">
        {bars.map((amp, i) => (
          <div
            key={i}
            className={`flex-1 rounded-full ${
              i / bars.length <= progress
                ? isMine
                  ? "bg-white"
                  : "bg-violet-600"
                : isMine
                  ? "bg-violet-300"
                  : "bg-zinc-200"
            }`}
            style={{ height: `${Math.max(15, amp * 100)}%` }}
          />
        ))}
      </div>
      <span className={`shrink-0 text-xs ${isMine ? "text-violet-100" : "text-zinc-400"}`}>
        {isPlaying ? formatDuration(Math.floor(progress * duration)) : formatDuration(duration)}
      </span>
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={() => {
          const a = audioRef.current;
          if (a?.duration) setProgress(a.currentTime / a.duration);
        }}
        onEnded={() => {
          setIsPlaying(false);
          setProgress(0);
        }}
      />
    </div>
  );
}
