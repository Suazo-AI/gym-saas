export type SourceCrop = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};

export function coverCrop(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): SourceCrop {
  if (
    [sourceWidth, sourceHeight, targetWidth, targetHeight].some(
      (value) => !Number.isFinite(value) || value <= 0,
    )
  ) {
    throw new Error("Capture dimensions must be positive finite numbers.");
  }

  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;

  if (sourceRatio > targetRatio) {
    const sw = sourceHeight * targetRatio;
    return {
      sx: (sourceWidth - sw) / 2,
      sy: 0,
      sw,
      sh: sourceHeight,
    };
  }

  const sh = sourceWidth / targetRatio;
  return {
    sx: 0,
    sy: (sourceHeight - sh) / 2,
    sw: sourceWidth,
    sh,
  };
}
