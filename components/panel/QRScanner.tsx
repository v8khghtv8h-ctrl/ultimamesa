"use client";
import { useEffect, useRef, useState } from "react";

// Lee el QR de la reserva con la cámara trasera. jsQR se carga recién al abrir el lector.
export function QRScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const found = useRef(onCode);
  found.current = onCode;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    (async () => {
      try {
        const [{ default: jsQR }, media] = await Promise.all([
          import("jsqr"),
          navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false }),
        ]);
        stream = media;
        if (stopped || !video.current || !ctx) { media.getTracks().forEach((t) => t.stop()); return; }
        video.current.srcObject = media;
        await video.current.play();

        const scan = () => {
          const v = video.current;
          if (stopped || !v) return;
          if (v.videoWidth) {
            // Una imagen chica alcanza para leer el QR y no recalienta el celular.
            const scale = Math.min(1, 640 / v.videoWidth);
            canvas.width = Math.round(v.videoWidth * scale);
            canvas.height = Math.round(v.videoHeight * scale);
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const qr = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: "dontInvert" });
            const code = qr?.data.toUpperCase().match(/UM-[A-Z0-9]{5}/)?.[0];
            if (code) { navigator.vibrate?.(80); found.current(code); return; }
          }
          timer = window.setTimeout(scan, 200);
        };
        scan();
      } catch {
        if (!stopped) setError("No pudimos abrir la cámara. Revisá el permiso del navegador o escribí el código a mano.");
      }
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="scan" role="dialog" aria-modal="true" aria-label="Escanear QR de la reserva">
      <div className="scan-in">
        <div className="scan-view">
          <video ref={video} muted playsInline aria-hidden="true" />
          <span className="scan-frame" />
        </div>
        <p>{error || "Apuntá al QR que muestra la persona en su celular."}</p>
        <button className="outline" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
