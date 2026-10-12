"""Assemble an evidence-based Lognac video (1080p, with a duration limit).

Run after scripts/synthesize_demo_voice.ps1. Requires Pillow and ffmpeg. The
source shots are screenshots or editorial cards derived from real demo output.
"""

from __future__ import annotations

import json
import argparse
import math
import os
import shutil
import subprocess
import sys
import wave
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / "docs" / "demo"
WORK = DEMO / ".work"
FPS = 24
GAP = 0.65


def ffmpeg_executable() -> str:
    if value := os.environ.get("FFMPEG_BIN"):
        return value
    if value := shutil.which("ffmpeg"):
        return value
    sys.path.insert(0, str(DEMO / ".builddeps"))
    import imageio_ffmpeg  # type: ignore

    return imageio_ffmpeg.get_ffmpeg_exe()


def duration(path: Path) -> float:
    with wave.open(str(path), "rb") as audio:
        return audio.getnframes() / audio.getframerate()


def focus_crop(source: Path, box: tuple[int, int, int, int], dest: Path) -> Path:
    image = Image.open(source).convert("RGB")
    crop = image.crop(box)
    height = round(crop.height * 1920 / crop.width)
    crop.resize((1920, height), Image.Resampling.LANCZOS).save(dest, quality=94)
    return dest


def close_slide(dest: Path) -> Path:
    image = Image.new("RGB", (1920, 1080), "#fafbf9")
    d = ImageDraw.Draw(image)
    bold = "C:/Windows/Fonts/segoeuib.ttf"
    regular = "C:/Windows/Fonts/segoeui.ttf"
    f86 = ImageFont.truetype(bold, 86)
    f50 = ImageFont.truetype(bold, 50)
    f32 = ImageFont.truetype(regular, 32)
    f27 = ImageFont.truetype(regular, 27)
    dark, teal, muted = "#14221e", "#007e70", "#54655f"
    d.rounded_rectangle((72, 56, 132, 116), radius=13, fill="#dff3ed", outline=teal, width=3)
    d.line((85, 86, 119, 86), fill=teal, width=5)
    d.line((102, 69, 102, 103), fill=teal, width=5)
    d.text((154, 49), "lognac.", font=f50, fill=dark)
    d.text((72, 198), "A review the care team can inspect.", font=f86, fill=dark)
    d.text((74, 315), "Fictional UK medication handovers · written report first · evidence graph on demand", font=f32, fill=muted)

    boxes = [
        ("PRODUCT", "Source-linked findings", "Clinician decision gate"),
        ("RELIABILITY", "Neatlogs failed step → retry", "Separate clean success trace"),
        ("BUILD + PLAN", "Entire code impact + 17 tests", "cfo.ai hypothetical cash view"),
    ]
    for i, (label, first, second) in enumerate(boxes):
        x0 = 73 + i * 610
        d.rounded_rectangle((x0, 450, x0 + 565, 758), radius=26, fill="white", outline="#c6d8d1", width=3)
        d.text((x0 + 30, 481), label, font=f27, fill=teal)
        d.text((x0 + 30, 548), first, font=f32, fill=dark)
        d.text((x0 + 30, 620), second, font=f27, fill=muted)

    d.line((72, 844, 1848, 844), fill="#c6d8d1", width=2)
    d.text((72, 882), "github.com/Afghanistan8/lognac", font=f32, fill=dark)
    d.text((72, 951), "Synthetic prototype. No live prescribing or complete safety-feed coverage.", font=f27, fill=muted)
    image.save(dest)
    return dest


def video_filter(scene_id: str, frame_count: int) -> str:
    n = max(1, frame_count - 1)
    if scene_id == "02-review":
        return f"scale=1920:-2,crop=1920:1080:0:'(in_h-out_h)*n/{n}',format=yuv420p"
    if scene_id == "03-graph":
        return f"scale=1920:-2,crop=1920:1080:0:'(in_h-out_h)*n/{n}',format=yuv420p"
    if scene_id == "03-gate":
        return f"crop=1920:1080:'(in_w-out_w)*n/{n}':'(in_h-out_h)*n/{n}',format=yuv420p"
    if scene_id in {"05-entire", "06-cfo"}:
        return f"crop=1920:1080:0:'(in_h-out_h)*n/{n}',format=yuv420p"
    if scene_id in {"01-problem", "04-bug", "07-neatlogs", "08-close"}:
        if scene_id == "08-close":
            return "format=yuv420p"
        return "scale=1920:1080,format=yuv420p"
    return "scale=1920:1080,format=yuv420p"


def main() -> None:
    parser = argparse.ArgumentParser(description="Render a narrated Lognac demo")
    parser.add_argument("--segments", type=Path, default=DEMO / "segments.json")
    parser.add_argument("--output", type=Path, default=DEMO / "Lognac-submission-demo.mp4")
    parser.add_argument("--work-dir", type=Path, default=WORK)
    parser.add_argument("--max-duration", type=float, default=179.0)
    args = parser.parse_args()
    work = args.work_dir.resolve()
    work.mkdir(parents=True, exist_ok=True)
    segments = json.loads(args.segments.read_text(encoding="utf-8"))
    ffmpeg = ffmpeg_executable()
    focused = {
        "05-entire": focus_crop(ROOT / "docs/social/02-partner-tools.png", (1900, 570, 3790, 2070), work / "entire-focus.png"),
        "06-cfo": focus_crop(ROOT / "docs/social/02-partner-tools.png", (100, 570, 1880, 2070), work / "cfo-focus.png"),
        "08-close": close_slide(work / "close.png"),
    }
    files = []
    total = 0.0
    for segment in segments:
        scene_id = segment["id"]
        audio = work / "audio" / f"{scene_id}.wav"
        if not audio.exists():
            raise FileNotFoundError(f"Generate male narration first: {audio}")
        image = focused.get(scene_id, ROOT / segment["image"])
        scene_duration = duration(audio) + GAP
        frame_count = math.ceil(scene_duration * FPS)
        output = work / f"{scene_id}.mp4"
        command = [
            ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
            "-loop", "1", "-framerate", str(FPS), "-i", str(image),
            "-i", str(audio),
            "-filter_complex", f"[0:v]{video_filter(scene_id, frame_count)}[v];[1:a]apad=pad_dur={GAP},aresample=48000[a]",
            "-map", "[v]", "-map", "[a]",
            "-frames:v", str(frame_count),
            "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "1",
            "-movflags", "+faststart", str(output),
        ]
        print(f"Rendering {scene_id}: {scene_duration:.1f}s", flush=True)
        subprocess.run(command, check=True)
        files.append(output)
        total += scene_duration

    if total >= args.max_duration:
        raise RuntimeError(f"Planned duration {total:.2f}s exceeds the {args.max_duration:.0f}s limit")
    concat_list = work / "concat.txt"
    concat_list.write_text("".join(f"file '{item.as_posix()}'\n" for item in files), encoding="utf-8")
    final = args.output.resolve()
    subprocess.run([
        ffmpeg, "-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0",
        "-i", str(concat_list), "-c", "copy", "-movflags", "+faststart", str(final)
    ], check=True)
    print(f"Finished {final} (planned {total:.2f}s)", flush=True)


if __name__ == "__main__":
    main()
