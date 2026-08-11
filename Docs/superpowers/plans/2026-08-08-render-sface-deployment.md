# Render SFace Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the existing YuNet/SFace 128-dimensional face service reliably on Render using its Dockerfile.

**Architecture:** Keep Next.js and the Python service as separate authenticated HTTP processes. Build the Python service as a Docker image so YuNet and SFace are downloaded, checksum-verified, and baked into the image; deploy the exact reviewed commit to Render service `srv-d9ggjrupbkes73cno340`.

**Tech Stack:** FastAPI, Uvicorn, OpenCV, ONNXRuntime, Docker, Render CLI 2.22.0, Vitest, Python unittest.

---

### Task 1: Restore the authenticated SFace service

**Files:**
- Modify: `services/face-recognition/app.py`
- Test: `services/face-recognition/test_auth.py`
- Test: `services/face-recognition/test_quality.py`

- [ ] Run `python -m unittest discover -v` from `services/face-recognition` and confirm the current stray `S` causes import or syntax failure.
- [ ] Replace the stray `S` with the existing environment contract:

```python
SERVICE_TOKEN = os.getenv("FACE_RECOGNITION_SERVICE_TOKEN", "")
if len(SERVICE_TOKEN) < 32:
  raise RuntimeError("FACE_RECOGNITION_SERVICE_TOKEN must contain at least 32 characters.")
```

- [ ] Run `python -m unittest discover -v` and confirm authentication and 128-dimensional quality tests pass.

### Task 2: Make the Docker runtime honor Render's port

**Files:**
- Create: `services/face-recognition/test_deployment.py`
- Modify: `services/face-recognition/Dockerfile`

- [ ] Add a deployment contract test that reads `Dockerfile` and asserts it downloads both pinned ONNX models, verifies both SHA-256 hashes, exposes port 8010, and starts Uvicorn with `${PORT:-8010}`.
- [ ] Run `python -m unittest test_deployment.py -v` and confirm it fails because the current JSON `CMD` hardcodes port 8010.
- [ ] Replace the final command with:

```dockerfile
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8010}"]
```

- [ ] Run `python -m unittest discover -v` and confirm all Python tests pass.

### Task 3: Align the repository contract

**Files:**
- Modify: `AGENTS.md`
- Verify: `src/features/entries/services/face-embedding.service.ts`
- Verify: `src/features/entries/services/face-verification.repository.ts`
- Verify: `supabase/migrations/20260808050000_sface_128_dimensions.sql`
- Verify: `services/face-recognition/README.md`

- [ ] Replace the obsolete Buffalo/512 warning in `AGENTS.md` with the approved YuNet/SFace/128 decision and list the four coupled contracts.
- [ ] Run `rg -n "512|vector\(128\)|length\(128\)|embedding.length !== 128" AGENTS.md services/face-recognition src/features/entries supabase/migrations/20260808050000_sface_128_dimensions.sql` and confirm no active facial contract still requires 512.
- [ ] Run the focused Vitest suites for environment, embedding client, verification, and enrollment.

### Task 4: Validate the container locally

**Files:**
- Verify: `services/face-recognition/Dockerfile`

- [ ] Run `docker build --tag fitmanager-face-service:render services/face-recognition` and require exit code 0, including both checksum validations.
- [ ] Start the image on an unused local port with a non-production test token.
- [ ] Verify `/health` reports `opencv-sface`, `2021dec`, and `modelReady: true`.
- [ ] Verify `/embed` without a token returns `401`.
- [ ] Stop and remove only the test container.

### Task 5: Version and publish the reviewed fix

**Files:**
- Commit only the service, tests, `AGENTS.md`, design, and plan files.

- [ ] Run `git diff --check` and inspect `git status --short`.
- [ ] Commit the implementation with `fix: deploy SFace service on Render`.
- [ ] Push branch `diagnose/next-slow-filesystem` to `origin` so Render can fetch the exact commit.

### Task 6: Update and verify Render

**External resource:**
- Render service: `srv-d9ggjrupbkes73cno340` (`gym-saas`)

- [ ] Run `render services update srv-d9ggjrupbkes73cno340 --runtime docker --root-directory services/face-recognition --health-check-path /health --output json`.
- [ ] Set `$commitSha = git rev-parse HEAD`, then run `render deploys create srv-d9ggjrupbkes73cno340 --commit $commitSha --clear-cache --wait`.
- [ ] Query deploy logs and require a successful Docker build, model checksum verification, open port, and healthy service.
- [ ] Call Render `/health` and verify SFace is ready.
- [ ] Call `/embed` without authentication and require `401`.
- [ ] Call `/embed` with the configured token and an invalid image and require a controlled `400`, proving authentication passed without sending biometric data.

### Task 7: Final regression verification

**Files:**
- Verify the complete repository without additional edits.

- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Report Docker, Render, and repository verification results separately; do not claim real facial matching unless a consented test photograph was processed.
