"use client";

import { useEffect, useRef } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
  footer?: React.ReactNode;
}

export default function Modal({ open, onClose, title, children, width = "max-w-lg", footer }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-[2px] p-4 animate-fade-in"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className={`bg-white rounded-xl shadow-lg w-full ${width} max-h-[90vh] flex flex-col animate-slide-up`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h2 className="font-semibold text-gray-900 text-[15px]">{title}</h2>
          <button
            onClick={onClose}
            className="btn-icon text-base leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 overflow-y-auto flex-1">
          {children}
        </div>

        {/* Optional footer */}
        {footer && (
          <div className="px-5 py-4 border-t border-gray-100 shrink-0 flex justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
