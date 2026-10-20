'use client';

import React, { useEffect, useState } from 'react';

interface Electronapi {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
}

interface Tauriwebviewwindow {
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  close: () => Promise<void>;
}

interface Tauriapi {
  window?: {
    getCurrent?: () => Tauriwebviewwindow;
  };
}

type Desktopwindow = Window & typeof globalThis & {
  electronAPI?: Electronapi;
  __TAURI__?: Tauriapi;
};

function getelectron(): Electronapi | undefined {
  return typeof window === 'undefined' ? undefined : (window as Desktopwindow).electronAPI;
}

function gettauri(): Tauriwebviewwindow | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as Desktopwindow).__TAURI__?.window?.getCurrent?.();
}

export default function Titlebar() {
  const [isdesktop, setIsdesktop] = useState<boolean>(false);

  useEffect(() => {
    if (!getelectron() && !gettauri()) return;
    setIsdesktop(true);
    document.body.classList.add('is-electron');
  }, []);

  const minwin = () => {
    getelectron()?.minimize();
    void gettauri()?.minimize();
  };

  const maxwin = () => {
    getelectron()?.maximize();
    void gettauri()?.toggleMaximize();
  };

  const closewin = () => {
    getelectron()?.close();
    void gettauri()?.close();
  };

  return (
    <div id="electron-titlebar" className={isdesktop ? 'titlebar is-electron' : 'titlebar'}>
      <div className="drag-region" data-tauri-drag-region></div>
      <div className="window-controls">
        <button id="min-btn" onClick={minwin} aria-label="Thu nhỏ">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M 0,5 L 10,5" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
        <button id="max-btn" onClick={maxwin} aria-label="Phóng to">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M 0,0 L 10,0 L 10,10 L 0,10 Z" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
        <button id="close-btn" onClick={closewin} aria-label="Đóng">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M 0,0 L 10,10 M 10,0 L 0,10" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
      </div>
    </div>
  );
}
