#!/usr/bin/env python3
"""Generate the CloudMail app icon (envelope + AI sparkle, brand indigo).

Pure standard library (zlib/struct) rasterizer with 3x supersampling.
Outputs:
  src-tauri/icon-source.png  (1024x1024, for `tauri icon`)
  src/assets/icon.png        (512x512, About page)
"""

import math
import struct
import zlib
from pathlib import Path

SS = 3
SIZE = 1024
S = SIZE * SS


def clamp(v, lo, hi):
    return lo if v < lo else hi if v > hi else v


def lerp(a, b, t):
    return a + (b - a) * t


def point_in_rounded_rect(x, y, x0, y0, x1, y1, r):
    if x < x0 or x > x1 or y < y0 or y > y1:
        return False
    cx = clamp(x, x0 + r, x1 - r)
    cy = clamp(y, y0 + r, y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def point_in_polygon(x, y, pts):
    inside = False
    j = len(pts) - 1
    for i in range(len(pts)):
        xi, yi = pts[i]
        xj, yj = pts[j]
        if (yi > y) != (yj > y):
            xint = (xj - xi) * (y - yi) / (yj - yi) + xi
            if x < xint:
                inside = not inside
        j = i
    return inside


def dist_to_segment(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    wx, wy = px - ax, py - ay
    c1 = vx * wx + vy * wy
    if c1 <= 0:
        return math.hypot(px - ax, py - ay)
    c2 = vx * vx + vy * vy
    if c2 <= c1:
        return math.hypot(px - bx, py - by)
    t = c1 / c2
    return math.hypot(px - (ax + t * vx), py - (ay + t * vy))


def star_points(cx, cy, outer, inner, rotation=-90.0):
    pts = []
    for k in range(8):
        ang = math.radians(rotation + k * 45)
        r = outer if k % 2 == 0 else inner
        pts.append((cx + r * math.cos(ang), cy + r * math.sin(ang)))
    return pts


# palette
INDIGO_TOP = (124, 140, 248)   # #7C8CF8
INDIGO_BOTTOM = (67, 56, 202)  # #4338CA
WHITE = (255, 255, 255)
FLAP = (224, 231, 255)         # #E0E7FF
LINE = (199, 210, 254)         # #C7D2FE
SEAL = (99, 102, 241)          # #6366F1
AMBER = (253, 230, 138)        # #FDE68A

# geometry (in 1024 space)
BG = (0, 0, SIZE, SIZE, 224)
ENV = (176, 288, 848, 736, 56)
FLAP_TRI = [(176, 288), (848, 288), (512, 470)]
SEAL_C = (512, 470)
SEAL_R = 30
STAR1 = star_points(742, 208, 96, 34)
STAR2 = star_points(812, 128, 44, 16)
EDGE_LINES = [
    ((176, 288), (512, 470)),
    ((848, 288), (512, 470)),
    ((176, 736), (848, 736)),
]
LINE_HALF = 6


def render():
    # premultiplied-ish accumulation handled at downsample; store straight RGBA
    buf = bytearray(S * S * 4)

    def set_px(x, y, r, g, b, a):
        if x < 0 or y < 0 or x >= S or y >= S or a <= 0:
            return
        idx = (y * S + x) * 4
        buf[idx] = r
        buf[idx + 1] = g
        buf[idx + 2] = b
        buf[idx + 3] = a

    def fill_region(x0, y0, x1, y1, fn):
        x0 = max(0, int(x0 * SS))
        y0 = max(0, int(y0 * SS))
        x1 = min(S - 1, int(x1 * SS))
        y1 = min(S - 1, int(y1 * SS))
        for y in range(y0, y1 + 1):
            py = y / SS
            for x in range(x0, x1 + 1):
                px = x / SS
                c = fn(px, py)
                if c:
                    set_px(x, y, *c)

    def bg_fn(px, py):
        x0, y0, x1, y1, r = BG
        if not point_in_rounded_rect(px, py, x0, y0, x1, y1, r):
            return None
        t = (py - y0) / (y1 - y0)
        return (
            int(lerp(INDIGO_TOP[0], INDIGO_BOTTOM[0], t)),
            int(lerp(INDIGO_TOP[1], INDIGO_BOTTOM[1], t)),
            int(lerp(INDIGO_TOP[2], INDIGO_BOTTOM[2], t)),
            255,
        )

    def env_fn(px, py):
        x0, y0, x1, y1, r = ENV
        if not point_in_rounded_rect(px, py, x0, y0, x1, y1, r):
            return None
        return (*WHITE, 255)

    def flap_fn(px, py):
        if point_in_polygon(px, py, FLAP_TRI):
            return (*FLAP, 255)
        return None

    def seal_fn(px, py):
        if (px - SEAL_C[0]) ** 2 + (py - SEAL_C[1]) ** 2 <= SEAL_R ** 2:
            return (*SEAL, 255)
        return None

    def star_fn(pts, color):
        def fn(px, py):
            if point_in_polygon(px, py, pts):
                return (*color, 255)
            return None
        return fn

    def line_fn(px, py):
        for (ax, ay), (bx, by) in EDGE_LINES:
            if dist_to_segment(px, py, ax, ay, bx, by) <= LINE_HALF:
                return (*LINE, 255)
        return None

    fill_region(*BG[:4], bg_fn)
    fill_region(ENV[0], ENV[1], ENV[2], ENV[3], env_fn)
    fill_region(176, 288, 848, 470, flap_fn)
    fill_region(SEAL_C[0] - SEAL_R, SEAL_C[1] - SEAL_R, SEAL_C[0] + SEAL_R, SEAL_C[1] + SEAL_R, seal_fn)
    fill_region(640, 70, 860, 260, star_fn(STAR1, AMBER))
    fill_region(760, 70, 860, 190, star_fn(STAR2, WHITE))
    fill_region(176, 288, 848, 736, line_fn)

    # downsample SSxSS blocks (alpha-weighted average of straight colors)
    out = bytearray(SIZE * SIZE * 4)
    for oy in range(SIZE):
        for ox in range(SIZE):
            ar = ag = ab = aa = 0
            for dy in range(SS):
                for dx in range(SS):
                    idx = ((oy * SS + dy) * S + ox * SS + dx) * 4
                    r = buf[idx]
                    g = buf[idx + 1]
                    b = buf[idx + 2]
                    a = buf[idx + 3]
                    ar += r * a
                    ag += g * a
                    ab += b * a
                    aa += a
            n = SS * SS
            oidx = (oy * SIZE + ox) * 4
            if aa > 0:
                out[oidx] = ar // aa
                out[oidx + 1] = ag // aa
                out[oidx + 2] = ab // aa
                out[oidx + 3] = aa // n
    return out


def write_png(path, data, w, h):
    def chunk(tag, payload):
        c = struct.pack(">I", len(payload)) + tag + payload
        return c + struct.pack(">I", zlib.crc32(tag + payload) & 0xFFFFFFFF)

    raw = bytearray()
    stride = w * 4
    for y in range(h):
        raw.append(0)
        raw.extend(data[y * stride:(y + 1) * stride])
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    Path(path).write_bytes(png)


def main():
    root = Path(__file__).resolve().parents[1]
    print("rendering...")
    big = render()
    write_png(root / "src-tauri" / "icon-source.png", big, SIZE, SIZE)
    # 512 About icon: average 2x2 from 1024
    small = bytearray(512 * 512 * 4)
    for y in range(512):
        for x in range(512):
            ar = ag = ab = aa = 0
            for dy in range(2):
                for dx in range(2):
                    idx = ((y * 2 + dy) * SIZE + x * 2 + dx) * 4
                    r, g, b, a = big[idx], big[idx + 1], big[idx + 2], big[idx + 3]
                    ar += r * a
                    ag += g * a
                    ab += b * a
                    aa += a
            o = (y * 512 + x) * 4
            if aa > 0:
                small[o] = ar // aa
                small[o + 1] = ag // aa
                small[o + 2] = ab // aa
                small[o + 3] = aa // 4
    write_png(root / "src" / "assets" / "icon.png", small, 512, 512)
    print("done:", root / "src-tauri/icon-source.png", root / "src/assets/icon.png")


if __name__ == "__main__":
    main()
