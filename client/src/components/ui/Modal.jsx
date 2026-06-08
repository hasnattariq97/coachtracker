import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const Modal = ({ open, onClose, title, children, size = 'md' }) => {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };

  const modalContent = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Modal Container */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Panel */}
        <div className={`bg-white rounded-2xl shadow-xl w-full ${widths[size]} fade-in overflow-hidden pointer-events-auto`}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 id="modal-title" className="text-base font-heading font-semibold text-primary-900">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
          <div className="px-6 py-5">{children}</div>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
};

export default Modal;
