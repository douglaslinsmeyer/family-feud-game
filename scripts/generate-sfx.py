#!/usr/bin/env python3
"""Generate SFX for the EGPS Family Feud game.

Synthesizes six classic-game-show SFX as 16-bit mono WAVs into public/audio/.
Pure Python + numpy + stdlib `wave` — no external audio toolchain required.

Run:  python3 scripts/generate-sfx.py
"""
from __future__ import annotations

import wave
from pathlib import Path

import numpy as np

SR = 44100
OUT = Path(__file__).resolve().parent.parent / "public" / "audio"


def write_wav(name: str, samples: np.ndarray) -> None:
    # Normalize peak to -0.5 dBFS to guarantee no clipping after int16 conversion.
    peak = float(np.max(np.abs(samples)))
    if peak > 0:
        samples = samples * (0.94 / peak)
    pcm = (samples * 32767).astype(np.int16)
    path = OUT / name
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    size_kb = path.stat().st_size / 1024
    print(f"  {name:<24} {len(samples)/SR:5.2f}s  {size_kb:6.1f} KB")


def t(seconds: float) -> np.ndarray:
    return np.linspace(0.0, seconds, int(seconds * SR), endpoint=False)


def adsr(n: int, attack: float, decay: float, release: float, sustain_level: float = 0.85) -> np.ndarray:
    a = int(attack * SR)
    d = int(decay * SR)
    r = int(release * SR)
    s = max(n - a - d - r, 0)
    env = np.zeros(n, dtype=np.float64)
    if a > 0:
        env[:a] = np.linspace(0.0, 1.0, a)
    if d > 0:
        env[a:a + d] = np.linspace(1.0, sustain_level, d)
    if s > 0:
        env[a + d:a + d + s] = sustain_level
    if r > 0:
        env[a + d + s:a + d + s + r] = np.linspace(sustain_level, 0.0, r)
    return env


def exp_decay(n: int, tau_seconds: float) -> np.ndarray:
    return np.exp(-np.arange(n) / (tau_seconds * SR))


# --- 1. reveal-ding -----------------------------------------------------------
# Bright bell: A5 + E6 + an inharmonic bell partial at 2.76× (typical bell ratio)
# with a fast exponential decay for that "ding" character.
def gen_reveal_ding() -> np.ndarray:
    dur = 0.7
    tt = t(dur)
    n = len(tt)
    f1, f2 = 880.0, 1320.0
    f3 = f1 * 2.76
    tone = (
        0.55 * np.sin(2 * np.pi * f1 * tt) +
        0.35 * np.sin(2 * np.pi * f2 * tt) +
        0.18 * np.sin(2 * np.pi * f3 * tt)
    )
    env = exp_decay(n, tau_seconds=0.18)
    a = int(0.005 * SR)
    env[:a] *= np.linspace(0.0, 1.0, a)
    return tone * env


# --- 2. strike-sting (the iconic "EH-EHHH") -----------------------------------
# Two raspy honks: shorter higher tone, gap, longer lower tone with pitch droop.
# Square + detuned partials + soft saturation for nasal buzzer character.
def gen_strike_sting() -> np.ndarray:
    def honk(freq: float, dur_s: float, freq_drop: float = 0.0) -> np.ndarray:
        tt = t(dur_s)
        inst_freq = freq + freq_drop * (tt / dur_s)
        phase = 2 * np.pi * np.cumsum(inst_freq) / SR
        s = (
            0.55 * np.sign(np.sin(phase)) +
            0.30 * np.sin(2 * phase) +
            0.15 * np.sin(3 * phase + 0.3)
        )
        s = np.tanh(s * 1.6)
        env = adsr(len(s), attack=0.01, decay=0.04, release=0.05, sustain_level=0.85)
        return s * env

    h1 = honk(265.0, 0.22, freq_drop=-5.0)
    gap = np.zeros(int(0.07 * SR))
    h2 = honk(200.0, 0.78, freq_drop=-20.0)
    return np.concatenate([h1, gap, h2])


# --- 3. match-end (short victory sting) ---------------------------------------
# Major triad arpeggio C5-E5-G5 then held high C6, brass-ish harmonic stack.
def gen_match_end() -> np.ndarray:
    notes = [(523.25, 0.18), (659.25, 0.18), (783.99, 0.18), (1046.50, 0.7)]
    out = []
    for freq, dur in notes:
        tt = t(dur)
        s = np.zeros_like(tt)
        for k, amp in [(1, 1.00), (2, 0.45), (3, 0.30), (4, 0.18), (5, 0.10)]:
            s += amp * np.sin(2 * np.pi * freq * k * tt)
        s /= np.max(np.abs(s) + 1e-9)
        env = adsr(len(s), attack=0.01, decay=0.05,
                   release=min(0.12, dur * 0.4), sustain_level=0.85)
        out.append(s * env)
    return np.concatenate(out)


# --- 4. champion-fanfare ------------------------------------------------------
# Classic ta-ta-ta then triumphant climb: G4 staccato x3 → C5 → E5 → G5 held.
def gen_champion_fanfare() -> np.ndarray:
    pattern = [
        (392.00, 0.16, 0.04),
        (392.00, 0.16, 0.04),
        (392.00, 0.16, 0.06),
        (523.25, 0.55, 0.08),
        (659.25, 0.55, 0.08),
        (783.99, 1.40, 0.10),
    ]
    out = []
    for freq, dur, gap in pattern:
        tt = t(dur)
        s = np.zeros_like(tt)
        for k, amp in [(1, 1.00), (2, 0.55), (3, 0.40), (4, 0.25), (5, 0.18), (6, 0.12)]:
            s += amp * np.sin(2 * np.pi * freq * k * tt)
        s /= np.max(np.abs(s) + 1e-9)
        env = adsr(len(s), attack=0.015, decay=0.05,
                   release=min(0.20, dur * 0.4), sustain_level=0.85)
        out.append(s * env)
        if gap > 0:
            out.append(np.zeros(int(gap * SR)))
    return np.concatenate(out)


# --- 5. fm-tick (clock tick) --------------------------------------------------
# Filtered-noise click + faint 3.2kHz tonal component for "metallic" feel.
def gen_fm_tick() -> np.ndarray:
    dur = 0.08
    n = int(dur * SR)
    rng = np.random.default_rng(seed=42)
    noise = np.diff(np.concatenate([[0.0], rng.standard_normal(n)]))  # crude high-pass
    noise /= np.max(np.abs(noise) + 1e-9)
    tone = 0.3 * np.sin(2 * np.pi * 3200.0 * t(dur))
    s = 0.7 * noise + tone
    env = exp_decay(n, tau_seconds=0.012)
    a = int(0.001 * SR)
    env[:a] *= np.linspace(0.0, 1.0, a)
    return s * env


# --- 6. fm-time-up (long buzzer) ----------------------------------------------
# Sawtooth-ish buzzer with amplitude tremolo and slight pitch droop, soft-saturated.
def gen_fm_time_up() -> np.ndarray:
    dur = 0.9
    n = int(dur * SR)
    tt = t(dur)
    inst_freq = 130.0 - 8.0 * (tt / dur)
    phase = 2 * np.pi * np.cumsum(inst_freq) / SR
    s = np.zeros(n)
    for k in range(1, 11):
        s += np.sin(k * phase) / k
    s = np.tanh(s * 1.4)
    tremolo = 0.85 + 0.15 * np.sin(2 * np.pi * 12.0 * tt)
    env = adsr(n, attack=0.005, decay=0.0, release=0.08, sustain_level=1.0)
    return s * tremolo * env


GENERATORS = {
    "reveal-ding.wav": gen_reveal_ding,
    "strike-sting.wav": gen_strike_sting,
    "match-end.wav": gen_match_end,
    "champion-fanfare.wav": gen_champion_fanfare,
    "fm-tick.wav": gen_fm_tick,
    "fm-time-up.wav": gen_fm_time_up,
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    print(f"Writing to {OUT}")
    for name, fn in GENERATORS.items():
        write_wav(name, fn())
    print("Done.")


if __name__ == "__main__":
    main()
