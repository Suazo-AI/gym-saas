from pathlib import Path
import unittest


DOCKERFILE = Path(__file__).with_name("Dockerfile")


class FaceServiceDeploymentTests(unittest.TestCase):
  def test_docker_image_contains_verified_models_and_uses_render_port(self):
    dockerfile = DOCKERFILE.read_text(encoding="utf-8")

    self.assertIn("face_detection_yunet_2023mar.onnx", dockerfile)
    self.assertIn("face_recognition_sface_2021dec.onnx", dockerfile)
    self.assertIn("sha256sum --check", dockerfile)
    self.assertIn("EXPOSE 8010", dockerfile)
    self.assertIn("http://127.0.0.1:${PORT:-8010}/health", dockerfile)
    self.assertIn("--port ${PORT:-8010}", dockerfile)


if __name__ == "__main__":
  unittest.main()
