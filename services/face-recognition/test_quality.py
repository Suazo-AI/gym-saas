import unittest

import numpy as np

from app import assess_face_quality, normalise_embedding


class FaceQualityTests(unittest.TestCase):
  def test_rejects_a_face_that_is_too_small_for_reliable_matching(self):
    image = np.full((720, 960, 3), 128, dtype=np.uint8)
    face = np.array([400, 280, 90, 90, 425, 315, 465, 315, 445, 335, 430, 355, 460, 355, 0.99])

    with self.assertRaisesRegex(Exception, "FACE_TOO_SMALL"):
      assess_face_quality(image, face)

  def test_rejects_a_dark_capture_before_embedding(self):
    image = np.full((720, 960, 3), 10, dtype=np.uint8)
    face = np.array([330, 190, 300, 360, 410, 300, 550, 300, 480, 380, 425, 455, 535, 455, 0.99])

    with self.assertRaisesRegex(Exception, "FACE_TOO_DARK"):
      assess_face_quality(image, face)

  def test_normalises_a_512_dimension_insightface_embedding(self):
    embedding = normalise_embedding(np.ones((1, 512), dtype=np.float32))

    self.assertEqual(embedding.shape, (512,))
    self.assertAlmostEqual(float(np.linalg.norm(embedding)), 1.0, places=6)

  def test_rejects_an_embedding_from_an_incompatible_model(self):
    with self.assertRaisesRegex(Exception, "invalid embedding size"):
      normalise_embedding(np.ones((1, 128), dtype=np.float32))


if __name__ == "__main__":
  unittest.main()
