"""Selfie step-up verification using pretrained face embeddings
(FaceNet / InceptionResnetV1, pretrained on VGGFace2 via
`facenet-pytorch`). This is NOT a continuous signal and NOT part of
RiderModelBundle's per-session scoring — it only fires when the
two-axis combiner has already decided to escalate (handoff_signature
or ambiguous) and the product wants a decisive check, per the original
plan's "optional selfie step-up check" (already scoped, now built).

Fairness note, not optional: NEVER auto-ban on a failed match alone.
Published research shows facial-verification accuracy varies by skin
tone and other demographic factors — a failed match must route to
human review or an alternate verification method, matching edge cases
#29/#30 in the main doc's matrix. This module returns a similarity
score and a recommendation, never a final automated decision.

No real face dataset was available while building this (no labeled
selfie pairs in this project), so there is no accuracy number to
report here — only that the pipeline runs. Do not claim an evaluated
accuracy for this component until it's been tested on real, consented
face data with a fairness breakdown by cohort.
"""
import os

os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")  # known Windows OpenMP conflict, torch + numpy

import numpy as np
import torch
from PIL import Image

MATCH_THRESHOLD = 0.6  # cosine similarity; NOT calibrated on real data — see module docstring

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
        """Returns a similarity score and a RECOMMENDATION, never a final
        automated decision — see module docstring's fairness note."""
        if self.enrolled_embedding is None:
            return {"similarity": None, "face_detected": False,
                    "recommendation": "no_enrollment", "note": "no enrolled face on file"}
        emb = embed_face(challenge_image)
        if emb is None:
            return {"similarity": None, "face_detected": False,
                    "recommendation": "retry_or_human_review",
                    "note": "no face detected in challenge image — never penalize on this alone"}
        sim = cosine_similarity(self.enrolled_embedding, emb)
        recommendation = "pass" if sim >= MATCH_THRESHOLD else "human_review"
        return {"similarity": round(sim, 4), "face_detected": True, "recommendation": recommendation}
