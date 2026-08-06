'use client';

import React, { useEffect, useState } from 'react';

export default function Titlebar() {
  const [iselectron, setiselectron] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      setiselectron(true);
      document.body.classList.add('is-electron');
    }
  }, []);

  const minwin = () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      (window as any).electronAPI.minimize();
    }
  };

  const maxwin = () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      (window as any).electronAPI.maximize();
    }
  };

  const closewin = () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      (window as any).electronAPI.close();
    }
  };

  return (
    <div id="electron-titlebar" className={iselectron ? 'titlebar is-electron' : 'titlebar'}>
      <div className="drag-region"></div>
      <div className="window-controls">
        <button id="min-btn" onClick={minwin} aria-label="Minimize">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M 0,5 L 10,5" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
        <button id="max-btn" onClick={maxwin} aria-label="Maximize">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M 0,0 L 10,0 L 10,10 L 0,10 Z" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
        <button id="close-btn" onClick={closewin} aria-label="Close">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M 0,0 L 10,10 M 10,0 L 0,10" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
      </div>
    </div>
  );
}
