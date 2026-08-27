export async function generateWaveform(blob: Blob, samples = 40): Promise<number[]> {
  if (typeof window === "undefined") return Array(samples).fill(0.3);
  try {
    const audioContext = new AudioContext();
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const rawData = audioBuffer.getChannelData(0);
    const blockSize = Math.max(1, Math.floor(rawData.length / samples));
    await audioContext.close();
    return Array.from({ length: samples }, (_, i) => {
      const slice = rawData.slice(i * blockSize, (i + 1) * blockSize);
      const sum = slice.reduce((acc, val) => acc + Math.abs(val), 0);
      return Math.min(1, (sum / blockSize) * 3);
    });
  } catch {
    return Array(samples).fill(0.25);
  }
}
