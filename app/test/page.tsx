"use client";

import { useRef, useState } from "react";
import { fetchFile } from "@ffmpeg/util";

type TextLayer = {
  text: string;
  start: number;
  end: number;
  x: number;
  y: number;
};

export default function GifMaker() {
  const [video, setVideo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [gifUrl, setGifUrl] = useState<string | null>(null);

  const ffmpegRef = useRef<any>(null);

  const generateTextLayers = (texts: string[], duration = 5): TextLayer[] => {
    const chunk = duration / texts.length;

    return texts.map((text, index) => ({
      text,
      start: index * chunk,
      end: (index + 1) * chunk,
      x: "(w-text_w)/2", // center horizontally
      y: "h-50", // bottom
    }));
  };
  const textLayers = generateTextLayers(
    ["Nice Idea", "Go Home Baby", "JOY"],
    5,
  );

  const loadFFmpeg = async () => {
    if (!ffmpegRef.current) {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");

      const ffmpeg = new FFmpeg();

      // ✅ debug logs
      ffmpeg.on("log", ({ message }: any) => {
        console.log("FFMPEG:", message);
      });

      await ffmpeg.load();

      ffmpegRef.current = ffmpeg;
    }
  };

  const escapeText = (text: string) =>
    text.replace(/'/g, "\\'").replace(/:/g, "\\:");

  const generateFilter = () => {
    return textLayers
      .map((layer) => {
        return `drawtext=fontfile=ARIAL.TTF:text='${escapeText(
          layer.text,
        )}':enable='between(t,${layer.start},${layer.end})':x=${layer.x}:y=${layer.y}:fontsize=24:fontcolor=white`;
      })
      .join(",");
  };

  const handleConvert = async () => {
    if (!video) return;

    setLoading(true);

    await loadFFmpeg();

    const ffmpeg = ffmpegRef.current;

    if (!ffmpeg) {
      throw new Error("FFmpeg not initialized");
    }

    // ✅ write input video
    await ffmpeg.writeFile("input.mp4", await fetchFile(video));

    // ✅ write font file (IMPORTANT)

    await ffmpeg.writeFile("ARIAL.TTF", await fetchFile("/fonts/ARIAL.TTF"));
    const filter = generateFilter();

    console.log("FILTER:", filter);

    try {
      await ffmpeg.exec([
        "-i",
        "input.mp4",
        "-vf",
        `${filter},fps=10,scale=320:-1:flags=lanczos`,
        "-t",
        "5",
        "-loop",
        "0",
        "output.gif",
      ]);

      const data = await ffmpeg.readFile("output.gif");

      console.log("OUTPUT SIZE:", data.length);

      if (!data || data.length === 0) {
        throw new Error("Generated GIF is empty");
      }

      const url = URL.createObjectURL(
        new Blob([data.buffer], { type: "image/gif" }),
      );

      setGifUrl(url);
    } catch (err) {
      console.error("FFmpeg error:", err);
      alert("Failed to generate GIF. Check console logs.");
    }

    setLoading(false);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Minimal GIF Maker</h2>

      <input
        type="file"
        accept="video/*"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            setVideo(e.target.files[0]);
          }
        }}
      />

      <br />
      <br />

      <button onClick={handleConvert} disabled={loading}>
        {loading ? "Processing..." : "Generate GIF"}
      </button>

      <br />
      <br />

      {gifUrl && (
        <div>
          <h3>Result:</h3>
          <img src={gifUrl} alt="gif result" />
          <br />
          <a href={gifUrl} download="result.gif">
            Download
          </a>
        </div>
      )}
    </div>
  );
}
