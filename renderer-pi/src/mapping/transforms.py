import cv2
import numpy as np


def validate_points(points, name="points", expected_count=4):
    if not isinstance(points, list) or len(points) != expected_count:
        raise ValueError(f"{name} must contain exactly {expected_count} points")
    parsed = []
    for point in points:
        if not isinstance(point, (list, tuple)) or len(point) != 2:
            raise ValueError(f"{name} entries must be [x, y] pairs")
        x, y = float(point[0]), float(point[1])
        parsed.append([x, y])
    return np.float32(parsed)


def validate_quad_points(points, name="points"):
    return validate_points(points, name, 4)


def warp_quad(frame, source_points, destination_points, output_size):
    src_pts = validate_quad_points(source_points, "source_points")
    dst_pts = validate_quad_points(destination_points, "destination_points")
    width, height = output_size

    matrix = cv2.getPerspectiveTransform(src_pts, dst_pts)
    warped = cv2.warpPerspective(frame, matrix, (width, height))

    mask_src = np.full(frame.shape[:2], 255, dtype=np.uint8)
    mask = cv2.warpPerspective(mask_src, matrix, (width, height))
    return warped, mask


def warp_triangle(frame, source_points, destination_points, output_size):
    src_pts = validate_points(source_points, "source_points", 3)
    dst_pts = validate_points(destination_points, "destination_points", 3)
    width, height = output_size

    matrix = cv2.getAffineTransform(src_pts, dst_pts)
    warped = cv2.warpAffine(frame, matrix, (width, height))

    mask_src = np.zeros(frame.shape[:2], dtype=np.uint8)
    cv2.fillConvexPoly(mask_src, np.int32(src_pts), 255)
    mask = cv2.warpAffine(mask_src, matrix, (width, height))
    return warped, mask


def alpha_blend(base, overlay, mask, opacity=1.0):
    opacity = max(0.0, min(1.0, float(opacity)))
    if opacity <= 0:
        return base

    alpha = (mask.astype(np.float32) / 255.0) * opacity
    alpha = alpha[..., None]
    blended = base.astype(np.float32) * (1.0 - alpha) + overlay.astype(np.float32) * alpha
    return np.clip(blended, 0, 255).astype(np.uint8)
