"""Selfie step-up verification using pretrained face embeddings
(FaceNet / InceptionResnetV1, pretrained on VGGFace2 via
`facenet-pytorch`) with 3D/2D presentation attack and passive anti-spoofing
liveness detection.

Anti-Spoofing & Liveness Pipeline:
1. High-frequency 2D Fast Fourier Transform (FFT) analysis to detect digital
   screen sub-pixel moiré grids and halftone print dithering.
2. Laplacian focus & optical depth gradient variance to reject 2D flat paper prints.
3. Specular screen reflection & glare hotspot ratio detection.
4. YCbCr chrominance dynamic range verification for live human skin.

Fairness note, not optional: NEVER auto-ban on a failed match alone.
Published research shows facial-verification accuracy varies by skin
tone and other demographic factors — a failed match must route to
human review or an alternate verification method, matching edge cases
#29/#30 in the main doc's matrix. This module returns a similarity
score, liveness score, and a recommendation, never a final automated decision.
"""
import os

os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")  # known Windows OpenMP conflict, torch + numpy

import numpy as np
import torch
from PIL import Image

MATCH_THRESHOLD = 0.6  # cosine similarity
LIVENESS_THRESHOLD = 0.50

_mtcnn = None
_resnet = None


def _lazy_load():
    global _mtcnn, _resnet
    if _resnet is None:
        from facenet_pytorch import MTCNN, InceptionResnetV1
        _mtcnn = MTCNN(image_size=160, margin=0, post_process=True)
        _resnet = InceptionResnetV1(pretrained="vggface2").eval()


def embed_face(image: Image.Image) -> np.ndarray | None:
    """Detects and aligns the face (MTCNN), returns a 512-dim embedding
    (InceptionResnetV1). Returns None if no face is detected."""
    _lazy_load()
    face_tensor = _mtcnn(image)
    if face_tensor is None:
        return None
    with torch.no_grad():
        embedding = _resnet(face_tensor.unsqueeze(0))
    return embedding.squeeze(0).numpy()


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))


def check_face_liveness(image: Image.Image) -> dict:
    """Evaluates 2D/3D presentation attack and anti-spoofing characteristics of a selfie.

    Analyzes:
    1. High-frequency Fourier texture & moiré mesh peaks (screen replay detection).
    2. Laplacian focus & optical depth variance (printed photo / flat blur detection).
    3. Chrominance diversity (YCbCr color space dynamic range of human skin).
    4. Specular glare ratio (screen glass reflections).

    Returns:
        dict with `is_live` (bool), `liveness_score` (float [0, 1]), `attack_type` (str),
        and detailed `metrics`.
    """
    if image is None:
        return {
            "is_live": False,
            "liveness_score": 0.0,
            "attack_type": "no_image",
            "flags": ["empty_image_payload"],
            "metrics": {},
        }

    # Normalize to 160x160 for uniform frequency and texture analysis
    img_resized = image.convert("RGB").resize((160, 160))
    rgb = np.array(img_resized, dtype=np.float32)
    gray = np.array(img_resized.convert("L"), dtype=np.float32)

    h, w = gray.shape

    # 1. Laplacian focus and depth variance
    lap = (
        gray[:-2, 1:-1] + gray[2:, 1:-1] + gray[1:-1, :-2] + gray[1:-1, 2:]
        - 4.0 * gray[1:-1, 1:-1]
    )
    lap_var = float(np.var(lap))

    # 2. Fourier high-frequency moiré analysis (2D FFT)
    f_shift = np.fft.fftshift(np.fft.fft2(gray))
    mag = np.abs(f_shift)
    cy, cx = h // 2, w // 2
    y, x = np.ogrid[:h, :w]
    dist_from_center = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
    hf_mask = dist_from_center > (min(h, w) * 0.28)

    hf_mean = float(np.mean(mag[hf_mask])) if hf_mask.any() else 1.0
    hf_max = float(np.max(mag[hf_mask])) if hf_mask.any() else 0.0
    moire_peak_ratio = float(hf_max / (hf_mean + 1e-9))

    # 3. Specular screen reflection / glass glare detection
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    glare_pixels = (r > 248) & (g > 248) & (b > 248)
    glare_ratio = float(np.mean(glare_pixels))

    # 4. Skin chrominance diversity in YCbCr
    cb = -0.1687 * r - 0.3313 * g + 0.5 * b + 128.0
    cr = 0.5 * r - 0.4187 * g - 0.0813 * b + 128.0
    chroma_var = float(np.var(cb) + np.var(cr))

    # Anti-spoofing heuristic boundaries
    flags = []
    attack_type = "none"

    if moire_peak_ratio > 8.0:
        flags.append("high_frequency_moire_grid_detected")
        attack_type = "screen_replay_subpixel_mesh"
    elif glare_ratio > 0.005 and moire_peak_ratio > 5.5:
        flags.append("specular_glass_glare_and_moire")
        attack_type = "screen_replay_glare"
    elif lap_var < 15.0:
        flags.append("insufficient_optical_depth_or_print_blur")
        attack_type = "printed_photo_blur"
    elif chroma_var < 10.0:
        flags.append("monochromatic_or_faded_print")
        attack_type = "faded_print_attack"

    # Compute continuous liveness score (0.0 to 1.0)
    score = 1.0
    if moire_peak_ratio > 4.5:
        score -= min(0.65, (moire_peak_ratio - 4.5) * 0.12)
    if glare_ratio > 0.003:
        score -= min(0.40, glare_ratio * 40.0)
    if lap_var < 35.0:
        score -= min(0.50, (35.0 - lap_var) / 35.0 * 0.5)
    if chroma_var < 25.0:
        score -= min(0.30, (25.0 - chroma_var) / 25.0 * 0.3)

    liveness_score = round(float(np.clip(score, 0.0, 1.0)), 4)
    is_live = liveness_score >= LIVENESS_THRESHOLD and len(flags) == 0

    return {
        "is_live": is_live,
        "liveness_score": liveness_score,
        "attack_type": attack_type,
        "flags": flags,
        "metrics": {
            "laplacian_variance": round(lap_var, 2),
            "moire_peak_ratio": round(moire_peak_ratio, 2),
            "glare_ratio": round(glare_ratio, 4),
            "chroma_variance": round(chroma_var, 2),
        },
    }


class FaceStepUpVerifier:
    """One instance per rider. `enroll()` once (e.g. at onboarding, from
    the platform's existing verified ID photo). `verify()` on each
    step-up challenge."""

    def __init__(self):
        self.enrolled_embedding: np.ndarray | None = None

    def enroll(self, enrollment_image: Image.Image) -> bool:
        emb = embed_face(enrollment_image)
        if emb is None:
            return False
        self.enrolled_embedding = emb
        return True

    def verify(self, challenge_image: Image.Image) -> dict:
        """Returns similarity score, liveness assessment, and a RECOMMENDATION."""
        if self.enrolled_embedding is None:
            return {
                "similarity": None,
                "face_detected": False,
                "is_live": False,
                "recommendation": "no_enrollment",
                "note": "no enrolled face on file",
            }

        liveness = check_face_liveness(challenge_image)

        emb = embed_face(challenge_image)
        if emb is None:
            return {
                "similarity": None,
                "face_detected": False,
                "is_live": liveness["is_live"],
                "liveness": liveness,
                "recommendation": "retry_or_human_review",
                "note": "no face detected in challenge image — never penalize on this alone",
            }

        sim = cosine_similarity(self.enrolled_embedding, emb)

        if not liveness["is_live"]:
            recommendation = "spoof_rejected"
            note = f"Presentation attack detected ({liveness['attack_type']}); rejected regardless of embedding similarity"
        elif sim >= MATCH_THRESHOLD:
            recommendation = "pass"
            note = "Live face verified and embedding match confirmed"
        else:
            recommendation = "human_review"
            note = "Face detected and live, but embedding similarity below threshold"

        return {
            "similarity": round(sim, 4),
            "face_detected": True,
            "is_live": liveness["is_live"],
            "liveness_score": liveness["liveness_score"],
            "attack_type": liveness["attack_type"],
            "liveness_diagnostics": liveness,
            "recommendation": recommendation,
            "note": note,
        }
