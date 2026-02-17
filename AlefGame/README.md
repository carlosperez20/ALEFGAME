How to run the FastAPI server

- Install Python dependencies: `pip install -r server/requirements.txt`
- Start the API server: `npm run dev:server`

The API exposes CORS for `http://localhost:5173`.

Endpoints

- POST `/analyze/video` — multipart `file`; query `return_mode` (`video|json|both`, default `video`), `role` (`tutorial|user`, default `user`). Processes frames with MediaPipe Pose, draws thick skeleton, saves processed MP4. Returns:
  - `video`: streams processed MP4 (`video/mp4`).
  - `json`: returns sampled angles per frame.
  - `both`: returns JSON with a temporary video path and angles.
- POST `/analyze/image` — multipart `file` (png/jpg). Returns JSON `{ png_base64, angles }` where `png_base64` is an annotated image.
- POST `/frame/extract` — multipart `file` (video) and `timestamp` (seconds, float). Returns a PNG of the closest frame.

Notes

- Requires `opencv-python` and `mediapipe` as listed in `server/requirements.txt`.
- MP4 writing uses `mp4v` fourcc.
