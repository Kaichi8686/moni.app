"use client";

import { useRef, useState } from "react";
import { Mic } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { generateWaveform } from "@/lib/messages/waveform";

type Props = {
  onStart?: () => void;
  onStop: (blob: Blob, duration: number, waveform: number[]) => void;
};

export function VoiceRecordButton({ onStart, onStop }: Props) {
  const { tx } = useI18n();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef(0);
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setIsRecording(false);
    setDuration(0);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const waveform = await generateWaveform(blob);
        const dur = durationRef.current || 1;
        onStop(blob, dur, waveform);
        durationRef.current = 0;
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      mediaRecorder.start();
      setIsRecording(true);
      onStart?.();
      timerRef.current = setInterval(() => {
        setDuration((d) => {
          const next = d >= 180 ? d : d + 1;
          durationRef.current = next;
          if (d >= 180) stopRecording();
          return next;
        });
      }, 1000);
    } catch {
      alert(tx("マイクの許可が必要です", "Microphone access is required"));
    }
  };

  return (
    <button
      type="button"
      onMouseDown={() => void startRecording()}
      onMouseUp={stopRecording}
      onMouseLeave={() => isRecording && stopRecording()}
      onTouchStart={(e) => {
        e.preventDefault();
        void startRecording();
      }}
      onTouchEnd={(e) => {
        e.preventDefault();
        stopRecording();
      }}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all ${
        isRecording ? "scale-125 bg-red-500 text-white" : "text-zinc-500"
      }`}
      aria-label={tx("ボイスメッセージ", "Voice message")}
    >
      {isRecording ? (
        <span className="text-[10px] font-mono">{duration}s</span>
      ) : (
        <Mic className="h-6 w-6" />
      )}
    </button>
  );
}
