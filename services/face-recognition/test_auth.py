import os
import unittest

from fastapi import HTTPException

os.environ.setdefault(
  "FACE_RECOGNITION_SERVICE_TOKEN",
  "face-service-unit-test-token-1234567890",
)

from app import SERVICE_TOKEN, require_service_token


class FaceServiceAuthenticationTests(unittest.TestCase):
  def test_rejects_a_missing_service_token(self):
    with self.assertRaises(HTTPException) as context:
      require_service_token(None)

    self.assertEqual(context.exception.status_code, 401)
    self.assertEqual(context.exception.detail, "UNAUTHORIZED")

  def test_accepts_the_configured_bearer_token(self):
    self.assertIsNone(require_service_token(f"Bearer {SERVICE_TOKEN}"))


if __name__ == "__main__":
  unittest.main()
