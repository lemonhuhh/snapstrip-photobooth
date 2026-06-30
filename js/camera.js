/* ===========================================================
   CAMERA CONTROLLER
   Wraps getUserMedia for a single <video> element. The app
   creates one instance for the main camera screen and a second
   instance for the single-photo "retake" modal, since each
   needs its own independent stream.
   =========================================================== */

class CameraController {
  constructor(videoEl) {
    this.video = videoEl;
    this.stream = null;
    this.facingMode = "user";
  }

  /** Starts (or restarts) the camera stream with the given facing mode. */
  async start(facingMode = this.facingMode) {
    this.stop();
    this.facingMode = facingMode;

    const constraintAttempts = [
      { video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false },
      { video: { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false },
      { video: true, audio: false }, // last-resort fallback for finicky devices/browsers
    ];

    let lastError = null;
    for (const constraints of constraintAttempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        this.stream = stream;
        this.video.srcObject = stream;
        await this.video.play().catch(() => {});
        return { ok: true };
      } catch (err) {
        lastError = err;
      }
    }
    return { ok: false, error: lastError };
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }

  async switchFacing() {
    const next = this.facingMode === "user" ? "environment" : "user";
    return this.start(next);
  }

  /** Detects whether the device exposes more than one camera. Labels are
   *  only populated after permission has been granted at least once. */
  static async hasMultipleCameras() {
    if (!navigator.mediaDevices?.enumerateDevices) return false;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === "videoinput").length > 1;
    } catch {
      return false;
    }
  }

  /** Grabs the current video frame into a data URL. When `mirrored` is
   *  true the output is flipped so a selfie-style preview is captured
   *  the way it visually appeared on screen, not mirror-reversed. */
  captureFrame(canvasEl, mirrored) {
    const video = this.video;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 960;
    canvasEl.width = w;
    canvasEl.height = h;
    const ctx = canvasEl.getContext("2d");
    ctx.save();
    if (mirrored) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();
    return canvasEl.toDataURL("image/png");
  }

  get isActive() {
    return !!this.stream;
  }
}
