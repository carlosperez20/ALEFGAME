from __future__ import annotations

import base64
import io
import json
import math
import os
import tempfile
from typing import Dict, List, Literal, Tuple

import numpy as np
import cv2
from fastapi import FastAPI, File, Form, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse, FileResponse
from starlette.background import BackgroundTask


app = FastAPI(title="Pose Analysis API")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _angle_between(a: np.ndarray, b: np.ndarray, c: np.ndarray) -> float:
    """Return the angle ABC (at point B) in degrees using 3D vectors.

    Handles zero-length vectors and clamps for numerical stability.
    """
    ba = a - b
    bc = c - b
    nba = np.linalg.norm(ba)
    nbc = np.linalg.norm(bc)
    if nba == 0 or nbc == 0:
        return float("nan")
    cosang = float(np.dot(ba, bc) / (nba * nbc))
    cosang = max(-1.0, min(1.0, cosang))
    return math.degrees(math.acos(cosang))


def compute_joint_angles(landmarks: Dict[str, Tuple[float, float, float]]) -> Dict[str, Dict[str, float]]:
    """Compute angles for knees, hips, ankles, shoulders, elbows for left/right.

    landmarks: dict mapping landmark name to (x, y, z) in normalized coordinates.
    Returns a dict: {
      "knees": {"left": deg, "right": deg},
      "hips": {"left": deg, "right": deg},
      "ankles": {"left": deg, "right": deg},
      "shoulders": {"left": deg, "right": deg},
      "elbows": {"left": deg, "right": deg}
    }
    """
    def v(name: str) -> np.ndarray:
        return np.array(landmarks.get(name, (np.nan, np.nan, np.nan)), dtype=float)

    # Angles:
    # knee: angle at knee from hip-knee-ankle
    left_knee = _angle_between(v("left_hip"), v("left_knee"), v("left_ankle"))
    right_knee = _angle_between(v("right_hip"), v("right_knee"), v("right_ankle"))

    # hip: angle at hip from shoulder-hip-knee
    left_hip = _angle_between(v("left_shoulder"), v("left_hip"), v("left_knee"))
    right_hip = _angle_between(v("right_shoulder"), v("right_hip"), v("right_knee"))

    # ankle: angle at ankle from knee-ankle-heel (or foot_index if heel missing)
    left_ankle = _angle_between(v("left_knee"), v("left_ankle"), v("left_heel"))
    right_ankle = _angle_between(v("right_knee"), v("right_ankle"), v("right_heel"))

    # shoulder: angle at shoulder from hip-shoulder-elbow
    left_shoulder = _angle_between(v("left_hip"), v("left_shoulder"), v("left_elbow"))
    right_shoulder = _angle_between(v("right_hip"), v("right_shoulder"), v("right_elbow"))

    # elbow: angle at elbow from shoulder-elbow-wrist
    left_elbow = _angle_between(v("left_shoulder"), v("left_elbow"), v("left_wrist"))
    right_elbow = _angle_between(v("right_shoulder"), v("right_elbow"), v("right_wrist"))

    return {
        "knees": {"left": left_knee, "right": right_knee},
        "hips": {"left": left_hip, "right": right_hip},
        "ankles": {"left": left_ankle, "right": right_ankle},
        "shoulders": {"left": left_shoulder, "right": right_shoulder},
        "elbows": {"left": left_elbow, "right": right_elbow},
    }


def draw_pose_landmarks_thick(image: np.ndarray, results) -> np.ndarray:
    """Draw thicker pose landmarks and connections on the image.

    Uses circles for keypoints and thicker lines for connections. Skips face mesh.
    """
    import mediapipe as mp

    mp_drawing = mp.solutions.drawing_utils
    mp_drawing_styles = mp.solutions.drawing_styles
    mp_pose = mp.solutions.pose

    if not results.pose_landmarks:
        return image

    # Base styles with heavier thickness
    landmark_drawing_spec = mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=3, circle_radius=3)
    connection_drawing_spec = mp_drawing.DrawingSpec(color=(0, 200, 255), thickness=4)

    mp_drawing.draw_landmarks(
        image,
        results.pose_landmarks,
        mp_pose.POSE_CONNECTIONS,
        landmark_drawing_spec,
        connection_drawing_spec,
    )
    return image


def _landmarks_to_dict(results) -> Dict[str, Tuple[float, float, float]]:
    import mediapipe as mp

    mp_pose = mp.solutions.pose
    if not results.pose_landmarks:
        return {}
    lms = results.pose_landmarks.landmark
    name_map = {lm.name.lower(): lm.value for lm in mp_pose.PoseLandmark}
    # name_map maps e.g. 'left_shoulder' -> index
    out: Dict[str, Tuple[float, float, float]] = {}
    for name, idx in name_map.items():
        pt = lms[idx]
        out[name] = (pt.x, pt.y, pt.z)
    return out


def _iter_file_chunks(path: str, chunk_size: int = 1024 * 1024):
    with open(path, "rb") as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            yield chunk


def _cleanup_temp(path: str):
    try:
        if os.path.exists(path):
            os.remove(path)
    except Exception:
        pass


@app.post("/analyze/video")
def analyze_video(
    file: UploadFile = File(...),
    return_mode: Literal["video", "json", "both"] = Query("video"),
    role: Literal["tutorial", "user"] = Query("user"),
):
    """Analyze a video with MediaPipe Pose and return JSON/video.

    Hardened for Windows + OpenCV: use closed NamedTemporaryFile, robust error handling, and clear console logs.
    """
    import mediapipe as mp
    import traceback

    # 1) Persist upload to a closed temp file (.mp4) before OpenCV touches it
    try:
        suffix = ".mp4"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_in:
            raw = file.file.read()
            tmp_in.write(raw)
            input_path = tmp_in.name
        print(f"[analyze_video] Received file: {file.filename}; temp: {input_path}; bytes: {len(raw)}")
    except Exception:
        print("[analyze_video] Failed to persist upload:")
        traceback.print_exc()
        return JSONResponse(status_code=400, content={"detail": "Failed to persist uploaded file"})

    cap = None
    writer = None
    output_path = None
    sample_angles: List[Dict] = []
    frame_index = 0
    total_processed = 0

    try:
        cap = cv2.VideoCapture(input_path)
        if not cap.isOpened():
            raise RuntimeError("OpenCV could not open the uploaded video")

        fps = cap.get(cv2.CAP_PROP_FPS)
        if not fps or fps <= 0 or math.isnan(fps):
            fps = 30.0
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0) or 640
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0) or 360
        print(f"[analyze_video] fps={fps}, size=({width}x{height})")

        # 3) Prepare VideoWriter for 'video' or 'both'
        need_video = return_mode in ("video", "both")
        if need_video:
            # Use mp4v; fallback to XVID on Windows if needed
            fourcc = cv2.VideoWriter_fourcc(*"mp4v")
            tmp_out = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
            output_path = tmp_out.name
            tmp_out.close()
            writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
            if not writer or not writer.isOpened():
                # try XVID fallback (common on Windows)
                fourcc = cv2.VideoWriter_fourcc(*"XVID")
                writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
            if not writer or not writer.isOpened():
                raise RuntimeError("Failed to initialize VideoWriter for output MP4")

        mp_pose = mp.solutions.pose
        sample_every = 5  # Sample every N frames for JSON
        with mp_pose.Pose(static_image_mode=False, model_complexity=1, enable_segmentation=False) as pose:
            while True:
                ok, frame = cap.read()
                if not ok:
                    break
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = pose.process(rgb)

                annotated = draw_pose_landmarks_thick(frame, results)
                if need_video:
                    writer.write(annotated)

                if results.pose_landmarks and (frame_index % sample_every == 0) and len(sample_angles) < 50:
                    lmk = _landmarks_to_dict(results)
                    angles = compute_joint_angles(lmk)
                    sample_angles.append({"frame": frame_index, "angles": angles})

                frame_index += 1
                total_processed += 1

        print(f"[analyze_video] total frames processed: {total_processed}")

    except Exception as ex:
        print("[analyze_video] Processing error:")
        import traceback as _tb
        _tb.print_exc()
        # Cleanup created output file if any
        if writer is not None:
            try:
                writer.release()
            except Exception:
                pass
        if cap is not None:
            try:
                cap.release()
            except Exception:
                pass
        _cleanup_temp(input_path)
        if output_path:
            _cleanup_temp(output_path)
        return JSONResponse(status_code=400, content={"detail": str(ex)})

    # Normal cleanup and return based on mode
    if cap is not None:
        cap.release()
    if writer is not None:
        writer.release()
    _cleanup_temp(input_path)

    if return_mode == "json":
        if output_path:
            _cleanup_temp(output_path)
        return JSONResponse({
            "role": role,
            "samples": sample_angles,
            "total_frames": total_processed,
        })
    elif return_mode == "video":
        # Return the processed video as a file download/stream
        return FileResponse(output_path, media_type="video/mp4", filename=os.path.basename(output_path))
    else:  # both
        # Provide relative path to help the frontend show a link if desired
        rel_path = os.path.relpath(output_path)
        return JSONResponse({
            "role": role,
            "video_path": rel_path,
            "samples": sample_angles,
            "total_frames": total_processed,
        })


@app.post("/analyze/image")
def analyze_image(file: UploadFile = File(...)):
    import mediapipe as mp

    data = np.frombuffer(file.file.read(), dtype=np.uint8)
    img = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if img is None:
        return JSONResponse(status_code=400, content={"error": "Invalid image"})

    mp_pose = mp.solutions.pose
    with mp_pose.Pose(static_image_mode=True, model_complexity=1) as pose:
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        results = pose.process(rgb)
        annotated = img.copy()
        annotated = draw_pose_landmarks_thick(annotated, results)

        angles = {}
        if results.pose_landmarks:
            lmk = _landmarks_to_dict(results)
            angles = compute_joint_angles(lmk)

    ok, buf = cv2.imencode(".png", annotated)
    if not ok:
        return JSONResponse(status_code=500, content={"error": "Encoding failed"})
    b64_png = base64.b64encode(buf.tobytes()).decode("ascii")
    return JSONResponse({
        "png_base64": b64_png,
        "angles": angles,
    })


@app.post("/frame/extract")
def extract_frame(
    file: UploadFile = File(...),
    timestamp: float = Query(..., description="Timestamp in seconds"),
):
    # Save upload to temp
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename or "")[1] or ".mp4") as tmp_in:
        tmp_in.write(file.file.read())
        input_path = tmp_in.name

    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        _cleanup_temp(input_path)
        return JSONResponse(status_code=400, content={"error": "Could not read video"})

    fps = cap.get(cv2.CAP_PROP_FPS)
    if not fps or fps <= 0 or math.isnan(fps):
        fps = 30.0
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    target_index = int(round(max(0.0, timestamp) * fps))
    target_index = max(0, min(frame_count - 1, target_index)) if frame_count > 0 else target_index

    cap.set(cv2.CAP_PROP_POS_FRAMES, target_index)
    ok, frame = cap.read()
    cap.release()
    _cleanup_temp(input_path)

    if not ok or frame is None:
        return JSONResponse(status_code=404, content={"error": "Frame not found"})

    ok, buf = cv2.imencode(".png", frame)
    if not ok:
        return JSONResponse(status_code=500, content={"error": "Encoding failed"})
    return Response(content=buf.tobytes(), media_type="image/png")


# Root for quick health check
@app.get("/")
def root():
    return {"status": "ok"}


@app.get("/health")
def health():
    return {"ok": True}
