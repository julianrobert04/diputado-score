"use client";

import Image from "next/image";
import { useState } from "react";

interface Props {
  photoUrl: string;
  fullName: string;
  size: number;
  ringClass?: string;
}

export function RankingAvatar({ photoUrl, fullName, size, ringClass }: Props) {
  const [imgError, setImgError] = useState(false);

  // Los retratos de www.asamblea.go.cr se sirven sin optimizar: su servidor omite
  // el CA intermedio de la cadena TLS, así que el optimizador de imágenes de Next
  // (proceso Node) no puede verificarla y fallaría la descarga, dejando la inicial
  // como fallback. Las imágenes de ui-avatars.com sí se pueden optimizar.
  const isAsamblea = photoUrl.includes("asamblea.go.cr");

  return (
    <div
      className={`rounded-full overflow-hidden bg-zinc-800 flex-shrink-0 ${ringClass ?? ""}`}
      style={{ width: size, height: size }}
    >
      {photoUrl && !imgError ? (
        <Image
          src={photoUrl}
          alt={fullName}
          width={size}
          height={size}
          sizes={`${size}px`}
          unoptimized={isAsamblea}
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
