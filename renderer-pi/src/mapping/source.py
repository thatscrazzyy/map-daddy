import os

import cv2
import numpy as np


def placeholder_frame(width, height, message="Media unavailable"):
    width = max(64, int(width or 640))
    height = max(64, int(height or 360))
    frame = np.zeros((height, width, 3), dtype=np.uint8)
    frame[:, :] = (28, 28, 34)
    cv2.rectangle(frame, (0, 0), (width - 1, height - 1), (220, 64, 64), 4)
    cv2.putText(
        frame,
        message[:42],
        (24, max(48, height // 2)),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (255, 255, 255),
        2,
        cv2.LINE_AA,
    )
    return frame


class Source:
    def __init__(self, data, media_cache):
        self.id = data.get("id")
        self.name = data.get("name") or self.id or "Source"
        self.type = data.get("type", "image")
        self.url = data.get("url", "")
        self.declared_width = data.get("width") or 640
        self.declared_height = data.get("height") or 360
        self.width = self.declared_width
        self.height = self.declared_height
        self.loop = bool(data.get("loop", True))
        self.muted = bool(data.get("muted", True))
        self.media_cache = media_cache
        self.loaded = False
        self.error = None

    def load(self):
        self.loaded = True

    def is_ready(self):
        return self.loaded and not self.error

    def get_frame(self):
        return placeholder_frame(self.width, self.height, self.error or "Unsupported source")

    def release(self):
        pass

    @staticmethod
    def from_dict(data, media_cache):
        source_type = (data.get("type") or "image").lower()
        if source_type == "video":
            return VideoSource(data, media_cache)
        if source_type == "image":
            return ImageSource(data, media_cache)
        return Source(data, media_cache)


class ImageSource(Source):
    def __init__(self, data, media_cache):
        super().__init__(data, media_cache)
        self.frame = None

    def load(self):
        if self.loaded:
            return
        self.loaded = True
        if not self.url:
            self.error = "Missing image URL"
            return
        try:
            path = self.media_cache.get_file(self.url)
            image = cv2.imread(path, cv2.IMREAD_UNCHANGED)
            if image is None:
                raise ValueError("OpenCV could not decode image")
            if image.ndim == 2:
                image = cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
            elif image.shape[2] == 4:
                image = cv2.cvtColor(image, cv2.COLOR_BGRA2RGB)
            else:
                image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            self.frame = image
            self.height, self.width = image.shape[:2]
        except Exception as exc:
            self.error = f"Image failed: {exc}"
            print(f"[Map Daddy Receiver] {self.name}: {self.error}")

    def get_frame(self):
        self.load()
        if self.frame is None:
            return placeholder_frame(self.width, self.height, self.error or "Image unavailable")
        return self.frame


class VideoSource(Source):
    def __init__(self, data, media_cache):
        super().__init__(data, media_cache)
        self.capture = None
        self.last_frame = None

    def load(self):
        if self.loaded:
            return
        self.loaded = True
        if not self.url:
            self.error = "Missing video URL"
            return
        try:
            path = self.media_cache.get_file(self.url)
            if not os.path.exists(path):
                raise FileNotFoundError(path)
            self.capture = cv2.VideoCapture(path)
            if not self.capture.isOpened():
                raise ValueError("OpenCV VideoCapture could not open video")
            width = int(self.capture.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(self.capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
            if width and height:
                self.width = width
                self.height = height
        except Exception as exc:
            self.error = f"Video failed: {exc}"
            print(f"[Map Daddy Receiver] {self.name}: {self.error}")

    def get_frame(self):
        self.load()
        if not self.capture or self.error:
            return placeholder_frame(self.width, self.height, self.error or "Video unavailable")

        ok, frame = self.capture.read()
        if not ok:
            if self.loop:
                self.capture.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ok, frame = self.capture.read()
            if not ok:
                return self.last_frame if self.last_frame is not None else placeholder_frame(
                    self.width, self.height, "Video ended"
                )

        frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        self.last_frame = frame
        return frame

    def release(self):
        if self.capture:
            self.capture.release()
            self.capture = None
