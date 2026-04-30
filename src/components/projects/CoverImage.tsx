/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";

type CoverImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
};

export function CoverImage({ src, alt, className }: CoverImageProps) {
  const normalizedSrc = src?.trim() ?? "";
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [normalizedSrc]);

  const showImage = normalizedSrc.length > 0 && !failed;

  return (
    <div className={clsx("relative aspect-video w-full overflow-hidden rounded bg-paper", className)}>
      {showImage ? (
        <img
          src={normalizedSrc}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-paper via-white to-line/40 px-4 text-center">
          <div>
            <p className="text-sm font-semibold text-ink/65">默认封面</p>
            <p className="mt-1 text-xs text-ink/45">暂无可显示的封面图</p>
          </div>
        </div>
      )}
    </div>
  );
}
