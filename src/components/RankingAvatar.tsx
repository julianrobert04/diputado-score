"use client";

import { useState } from "react";

interface Props {
  photoUrl: string;
  fullName: string;
  size: number;
  ringClass?: string;
}

export function RankingAvatar({ photoUrl, fullName, size, ringClass }: Props) {
  const [imgError, setImgError] = useState(false);
  return (
    <div
      className={`rounded-full overflow-hidden bg-zinc-800 flex-shrink-0 ${ringClass ?? ""}`}
      style={{ width: size, height: size }}
    >
      {photoUrl && !imgError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={fullName}
          width={size}
          height={size}
          className="object-cover object-top w-full h-full"
          onError={() => setImgError(true)}
        />
      ) : (
        <span
          className="w-full h-full flex items-center justify-center font-black text-zinc-400 select-none"
          style={{ fontSize: size * 0.45 }}
        >
          {fullName.charAt(0)}
        </span>
      )}
    </div>
  );
}
