'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useapp } from '../context/appcontext';
import { SyncState } from '../lib/types';

export default function SyncModal() {
  const {
    syncmodalopen,
    setsyncmodalopen,
    mylist,
    history,
    audiosettings,
    playersource,
    restoresyncdata,
    showtoast,
    detailitem,
    activeplayer,
    audiopanelopen
  } = useapp();

  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [pin, setPin] = useState<string>('------');
  const [timeremaining, setTimeremaining] = useState<number>(0);
  const [exportstatus, setExportstatus] = useState<string>('');
  const [importcode, setImportcode] = useState<string>('');
  const [importstatus, setImportstatus] = useState<string>('');
  const [isloading, setIsloading] = useState<boolean>(false);

  const timerref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expiring = useRef<boolean>(false);
  const openref = useRef<boolean>(syncmodalopen);
  openref.current = syncmodalopen;
  const closetimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closetimer.current) clearTimeout(closetimer.current);
    };
  }, []);

  useEffect(() => {
    if (timeremaining <= 0) return;
    timerref.current = setTimeout(() => {
      setTimeremaining(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      if (timerref.current) clearTimeout(timerref.current);
    };
  }, [timeremaining]);

  useEffect(() => {
    if (!expiring.current || timeremaining > 0) return;
    expiring.current = false;
    setPin('------');
    setExportstatus('Mã PIN đã hết hạn');
  }, [timeremaining]);

  useEffect(() => {
    if (!syncmodalopen || detailitem || activeplayer || audiopanelopen) return;
    const onkey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        setsyncmodalopen(false);
      }
    };
    window.addEventListener('keydown', onkey, true);
    return () => window.removeEventListener('keydown', onkey, true);
  }, [syncmodalopen, detailitem, activeplayer, audiopanelopen, setsyncmodalopen]);

  useEffect(() => {
    if (syncmodalopen) return;
    expiring.current = false;
    setPin('------');
    setTimeremaining(0);
    setExportstatus('');
    setImportcode('');
    setImportstatus('');
    setActiveTab('export');
  }, [syncmodalopen]);

  if (!syncmodalopen) return null;

  const generatePin = async () => {
    setIsloading(true);
    setExportstatus('');
    try {
      const payload: SyncState = {
        mylist,
        history,
        audiosettings,
        playersource
      };

      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: JSON.stringify(payload) })
      });

      const data = await res.json();
      if (!openref.current) return;

      if (res.ok && data.pin) {
        expiring.current = true;
        setPin(data.pin);
        setTimeremaining(600);
        setExportstatus('Mã PIN có hiệu lực trong 10 phút');
      } else {
        setExportstatus(data.error || 'Lỗi khi tạo mã PIN');
      }
    } catch (_) {
      if (openref.current) setExportstatus('Không thể kết nối đến máy chủ đồng bộ');
    } finally {
      setIsloading(false);
    }
  };

  const copyPin = async () => {
    if (!pin || pin === '------') return;
    try {
      await navigator.clipboard.writeText(pin);
      showtoast('Đã sao chép mã PIN vào bộ nhớ tạm');
    } catch (_) {
      showtoast('Không thể sao chép, hãy chép mã thủ công');
    }
  };

  const importPin = async () => {
    if (!importcode || importcode.length !== 6) {
      setImportstatus('Vui lòng nhập đúng 6 chữ số');
      return;
    }

    setIsloading(true);
    setImportstatus('');

    try {
      const res = await fetch(`/api/sync?code=${encodeURIComponent(importcode)}`);
      const result = await res.json();
      if (!openref.current) return;

      if (!res.ok || !result.data) {
        setImportstatus(result.error || 'Mã PIN không đúng hoặc đã hết hạn');
        return;
      }

      let parsed: SyncState;
      try {
        parsed = JSON.parse(result.data);
      } catch (_) {
        setImportstatus('Dữ liệu đồng bộ bị hỏng');
        return;
      }

      restoresyncdata(parsed);
      setImportstatus('Đồng bộ dữ liệu thành công!');
      closetimer.current = setTimeout(() => {
        setsyncmodalopen(false);
      }, 1500);
    } catch (_) {
      if (openref.current) setImportstatus('Không thể kết nối đến máy chủ đồng bộ');
    } finally {
      setIsloading(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `Hết hạn sau: ${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="sync-overlay active" id="sync-overlay" onClick={() => setsyncmodalopen(false)}>
      <div className="sync-modal" onClick={e => e.stopPropagation()}>
        <button
          className="sync-close"
          id="sync-close"
          title="Đóng"
          aria-label="Đóng cửa sổ đồng bộ"
          onClick={() => setsyncmodalopen(false)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="sync-header">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d1477a" strokeWidth="2">
            <path d="M4 4v5h5" />
            <path d="M20 20v-5h-5" />
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L4 4m16 16l-1.64-1.64A9 9 0 0 1 3.51 15" />
          </svg>
          <h3>Đồng bộ dữ liệu</h3>
        </div>

        <p className="sync-desc">
          Chuyển lịch sử xem, tiến độ và danh sách giữa các thiết bị bằng mã PIN 6 chữ số.
        </p>

        <div className="sync-tabs">
          <button
            className={`sync-tab ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => setActiveTab('export')}
          >
            Gửi
          </button>
          <button
            className={`sync-tab ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => setActiveTab('import')}
          >
            Nhận
          </button>
        </div>

        {activeTab === 'export' && (
          <div className="sync-panel" id="sync-export-panel">
            <div
              className={`sync-pin-display ${pin !== '------' ? 'active' : ''}`}
              id="sync-pin-display"
              tabIndex={0}
              role="button"
              onClick={copyPin}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  copyPin();
                }
              }}
              title="Nhấn để sao chép"
            >
              {pin}
            </div>
            <p className="sync-pin-hint">Nhập mã PIN này trên thiết bị còn lại</p>
            {timeremaining > 0 && <p className="sync-pin-timer" id="sync-pin-timer">{formatTimer(timeremaining)}</p>}

            <div className="sync-actions">
              <button
                className="sync-btn sync-btn-primary"
                id="sync-generate"
                onClick={generatePin}
                disabled={isloading}
              >
                {isloading ? 'Đang tạo...' : 'Tạo mã PIN'}
              </button>
            </div>
            {exportstatus && <div className="sync-status" id="sync-export-status">{exportstatus}</div>}
          </div>
        )}

        {activeTab === 'import' && (
          <div className="sync-panel" id="sync-import-panel">
            <div className="sync-code-input-wrap">
              <input
                type="text"
                className="sync-code-input"
                id="sync-import-code"
                maxLength={6}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="000000"
                value={importcode}
                onChange={e => setImportcode(e.target.value.replace(/\D/g, ''))}
                autoComplete="off"
              />
            </div>
            <div className="sync-actions">
              <button
                className="sync-btn sync-btn-primary"
                id="sync-import-btn"
                onClick={importPin}
                disabled={isloading}
              >
                {isloading ? 'Đang xử lý...' : 'Đồng bộ'}
              </button>
            </div>
            {importstatus && <div className="sync-status" id="sync-import-status">{importstatus}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
