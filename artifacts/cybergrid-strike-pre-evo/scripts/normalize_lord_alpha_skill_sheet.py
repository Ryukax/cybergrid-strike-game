"""Normalize an ImageGen frame board into the Lord Alpha runtime contract.

The source may be a horizontal strip or an explicit grid. This tool reflows its
eight row-major cells into one strip while keeping a shared crop and scale, so
the character does not pulse in size or jump vertically during playback.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageFilter


FRAME_COUNT = 8
FRAME_WIDTH = 240
FRAME_HEIGHT = 160
OUTPUT_GUTTER = 6


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--columns", type=int, default=8)
    parser.add_argument("--rows", type=int, default=1)
    parser.add_argument(
        "--remove-residue",
        action="store_true",
        help="Remove tiny disconnected ImageGen fragments while retaining authored body parts.",
    )
    parser.add_argument(
        "--ground-align",
        action="store_true",
        help="Register grounded frames to one shared foot/contact baseline.",
    )
    parser.add_argument(
        "--frame-centered-registration",
        action="store_true",
        help=(
            "Keep one shared body scale while centering each pose in its own "
            "cell. Use for aerial/summon boards whose source poses travel "
            "vertically; gameplay root motion then owns the world-space arc."
        ),
    )
    parser.add_argument(
        "--airborne-frames",
        default="",
        help="Comma-separated one-based frame numbers exempt from ground alignment.",
    )
    parser.add_argument(
        "--largest-only-frames",
        default="",
        help=(
            "Comma-separated one-based frame numbers where only the largest "
            "connected alpha component is retained. This removes cross-cell "
            "ImageGen bleed without stripping intentional detached details "
            "from every frame."
        ),
    )
    return parser.parse_args()


def remove_residue(frame: Image.Image) -> Image.Image:
    """Discard only components too small to be part of the authored character.

    ImageGen boards occasionally contain a handful of detached pixels or a
    miniature echo from a neighbouring pose. We find connected alpha regions,
    retain every region at least 0.6% as large as the main character, then
    dilate that keep-mask so antialiased edge pixels survive unchanged.
    """

    alpha = frame.getchannel("A")
    opaque = alpha.point(lambda value: 255 if value >= 16 else 0)
    width, height = frame.size
    pixels = opaque.load()
    visited = bytearray(width * height)
    components: list[list[tuple[int, int]]] = []

    for y in range(height):
        for x in range(width):
            offset = y * width + x
            if visited[offset] or not pixels[x, y]:
                continue
            visited[offset] = 1
            stack = [(x, y)]
            component: list[tuple[int, int]] = []
            while stack:
                current_x, current_y = stack.pop()
                component.append((current_x, current_y))
                for next_y in range(max(0, current_y - 1), min(height, current_y + 2)):
                    for next_x in range(max(0, current_x - 1), min(width, current_x + 2)):
                        next_offset = next_y * width + next_x
                        if visited[next_offset] or not pixels[next_x, next_y]:
                            continue
                        visited[next_offset] = 1
                        stack.append((next_x, next_y))
            components.append(component)

    if not components:
        return frame

    largest = max(len(component) for component in components)
    minimum = max(12, round(largest * 0.006))
    keep = Image.new("L", frame.size, 0)
    keep_pixels = keep.load()
    for component in components:
        if len(component) < minimum:
            continue
        for x, y in component:
            keep_pixels[x, y] = 255
    keep = keep.filter(ImageFilter.MaxFilter(5))

    cleaned = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    cleaned.paste(frame, mask=keep)
    return cleaned


def keep_largest_component(frame: Image.Image) -> Image.Image:
    """Keep the primary connected alpha region and its antialiased edge.

    This deliberately opt-in cleanup is for generated cells where a sizeable
    fragment from the neighbouring storyboard panel crossed the split. It is
    not the default because legitimate projectiles and armor fragments may be
    detached from the body in other animation frames.
    """

    alpha = frame.getchannel("A")
    opaque = alpha.point(lambda value: 255 if value >= 16 else 0)
    width, height = frame.size
    pixels = opaque.load()
    visited = bytearray(width * height)
    largest: list[tuple[int, int]] = []

    for y in range(height):
        for x in range(width):
            offset = y * width + x
            if visited[offset] or not pixels[x, y]:
                continue
            visited[offset] = 1
            stack = [(x, y)]
            component: list[tuple[int, int]] = []
            while stack:
                current_x, current_y = stack.pop()
                component.append((current_x, current_y))
                for next_y in range(max(0, current_y - 1), min(height, current_y + 2)):
                    for next_x in range(max(0, current_x - 1), min(width, current_x + 2)):
                        next_offset = next_y * width + next_x
                        if visited[next_offset] or not pixels[next_x, next_y]:
                            continue
                        visited[next_offset] = 1
                        stack.append((next_x, next_y))
            if len(component) > len(largest):
                largest = component

    if not largest:
        return frame

    keep = Image.new("L", frame.size, 0)
    keep_pixels = keep.load()
    for x, y in largest:
        keep_pixels[x, y] = 255
    keep = keep.filter(ImageFilter.MaxFilter(5))

    cleaned = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    cleaned.paste(frame, mask=keep)
    return cleaned


def main() -> None:
    args = parse_args()
    try:
        airborne_frames = {
            int(value.strip()) - 1
            for value in args.airborne_frames.split(",")
            if value.strip()
        }
    except ValueError as error:
        raise SystemExit("airborne frame numbers must be comma-separated integers") from error
    if any(index < 0 or index >= FRAME_COUNT for index in airborne_frames):
        raise SystemExit("airborne frame numbers must be between 1 and 8")
    try:
        largest_only_frames = {
            int(value.strip()) - 1
            for value in args.largest_only_frames.split(",")
            if value.strip()
        }
    except ValueError as error:
        raise SystemExit("largest-only frame numbers must be comma-separated integers") from error
    if any(index < 0 or index >= FRAME_COUNT for index in largest_only_frames):
        raise SystemExit("largest-only frame numbers must be between 1 and 8")
    with Image.open(args.source) as loaded:
        source = loaded.convert("RGBA")

    if args.columns * args.rows != FRAME_COUNT:
        raise SystemExit("source grid must contain exactly eight cells")

    alpha = source.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        raise SystemExit(f"source is fully transparent: {args.source}")
    if alpha.getextrema()[0] != 0:
        raise SystemExit(f"source lacks transparent pixels: {args.source}")

    x_edges = [round(index * source.width / args.columns) for index in range(args.columns + 1)]
    y_edges = [round(index * source.height / args.rows) for index in range(args.rows + 1)]
    source_frames: list[Image.Image] = []
    visible_bounds: list[tuple[int, int, int, int]] = []
    for index in range(FRAME_COUNT):
        column = index % args.columns
        row = index // args.columns
        frame = source.crop((
            x_edges[column],
            y_edges[row],
            x_edges[column + 1],
            y_edges[row + 1],
        ))
        if args.remove_residue:
            frame = remove_residue(frame)
        if index in largest_only_frames:
            frame = keep_largest_component(frame)
        # Ignore nearly invisible antialias residue when deriving the common
        # registration window. The actual pixels remain untouched.
        visible = frame.getchannel("A").point(lambda value: 255 if value >= 16 else 0)
        frame_bbox = visible.getbbox()
        if frame_bbox is None:
            raise SystemExit(f"generated frame {index + 1} is empty: {args.source}")
        source_frames.append(frame)
        visible_bounds.append(frame_bbox)

    # One shared scale preserves body size. Ordinary boards also retain one
    # shared source crop. Aerial/summon boards can instead register each pose
    # around its own alpha bounds so a high jump or raised hand does not make
    # every other frame shrink inside a tall union crop.
    if args.frame_centered_registration:
        raw_crop_width = max(item[2] - item[0] for item in visible_bounds)
        raw_crop_height = max(item[3] - item[1] for item in visible_bounds)
        padding = max(4, round(max(raw_crop_width, raw_crop_height) * 0.035))
        crop_width = raw_crop_width + padding * 2
        crop_height = raw_crop_height + padding * 2
        crop_left = crop_top = 0
        crop_right = crop_width
        crop_bottom = crop_height
    else:
        crop_left = min(item[0] for item in visible_bounds)
        crop_top = min(item[1] for item in visible_bounds)
        crop_right = max(item[2] for item in visible_bounds)
        crop_bottom = max(item[3] for item in visible_bounds)
        padding = max(4, round(max(crop_right - crop_left, crop_bottom - crop_top) * 0.035))
        max_cell_width = max(frame.width for frame in source_frames)
        max_cell_height = max(frame.height for frame in source_frames)
        crop_left = max(0, crop_left - padding)
        crop_top = max(0, crop_top - padding)
        crop_right = min(max_cell_width, crop_right + padding)
        crop_bottom = min(max_cell_height, crop_bottom + padding)
        crop_width = crop_right - crop_left
        crop_height = crop_bottom - crop_top
    scale = min(
        (FRAME_WIDTH - OUTPUT_GUTTER * 2) / crop_width,
        (FRAME_HEIGHT - OUTPUT_GUTTER * 2) / crop_height,
    )
    draw_width = max(1, round(crop_width * scale))
    draw_height = max(1, round(crop_height * scale))

    output = Image.new("RGBA", (FRAME_COUNT * FRAME_WIDTH, FRAME_HEIGHT), (0, 0, 0, 0))
    for index, frame in enumerate(source_frames):
        if args.frame_centered_registration:
            bound_left, bound_top, bound_right, bound_bottom = visible_bounds[index]
            center_x = (bound_left + bound_right) / 2
            frame_crop_left = round(center_x - crop_width / 2)
            frame_crop_right = frame_crop_left + crop_width
            frame_crop_bottom = bound_bottom + padding
            frame_crop_top = frame_crop_bottom - crop_height
            registered = frame.crop((
                frame_crop_left,
                frame_crop_top,
                frame_crop_right,
                frame_crop_bottom,
            ))
        else:
            registered = frame.crop((crop_left, crop_top, crop_right, crop_bottom))
        resized = registered.convert("RGBa").resize(
            (draw_width, draw_height), Image.Resampling.LANCZOS
        ).convert("RGBA")
        x = index * FRAME_WIDTH + (FRAME_WIDTH - draw_width) // 2
        y = FRAME_HEIGHT - OUTPUT_GUTTER - draw_height
        if args.ground_align and index not in airborne_frames:
            resized_visible = resized.getchannel("A").point(
                lambda value: 255 if value >= 16 else 0
            ).getbbox()
            if resized_visible is None:
                raise SystemExit(f"normalized frame {index + 1} is empty")
            current_bottom = y + resized_visible[3]
            y += (FRAME_HEIGHT - OUTPUT_GUTTER) - current_bottom
        output.alpha_composite(resized, (x, y))

    args.destination.parent.mkdir(parents=True, exist_ok=True)
    output.save(args.destination, format="PNG", optimize=False, compress_level=9)

    with Image.open(args.destination) as check:
        if check.mode != "RGBA" or check.size != (1920, 160):
            raise SystemExit(f"invalid output contract: {check.mode} {check.size}")
        for index in range(FRAME_COUNT):
            cell = check.crop((index * FRAME_WIDTH, 0, (index + 1) * FRAME_WIDTH, FRAME_HEIGHT))
            if cell.getchannel("A").getbbox() is None:
                raise SystemExit(f"normalized frame {index + 1} is empty")

    print(f"normalized {args.source.name} -> {args.destination} ({source.size} -> {output.size})")


if __name__ == "__main__":
    main()
