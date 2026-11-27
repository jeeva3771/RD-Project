import React, { useState, useRef, useEffect } from "react";

const EmojiHelpTooltip = () => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <span
      className="relative inline-flex items-center ml-1.5 align-middle"
      ref={containerRef}
    >
      {/* (i) Circular Info Trigger Button */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className="w-4 h-4 rounded-full border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-800 flex items-center justify-center text-[10px] font-bold cursor-pointer transition-all shadow-2xs hover:scale-105 select-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
        title="How to insert emojis"
        aria-label="How to insert emojis"
      >
        i
      </button>

      {/* Floating Popover / Tooltip */}
      {isOpen && (
        <div
          className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 p-3.5 z-50 text-left animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Triangular Arrow Pointer */}
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-t border-l border-gray-200 rotate-45" />

          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-gray-100 relative z-10">
            <div className="flex items-center gap-1.5">
              <span className="text-base">⌨️</span>
              <span className="text-xs font-bold text-gray-800">
                How to insert an Emoji
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-5 h-5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex items-center justify-center text-xs font-bold cursor-pointer transition"
            >
              ✕
            </button>
          </div>

          {/* Platforms List */}
          <div className="space-y-2 text-xs relative z-10">
            {/* Windows */}
            <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-base select-none mt-0.5">🪟</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-800 text-[11px]">
                    Windows PC
                  </span>
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-white border border-gray-300 rounded shadow-2xs text-gray-700">
                      Win
                    </kbd>
                    <span className="text-gray-400 text-[10px]">+</span>
                    <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-white border border-gray-300 rounded shadow-2xs text-gray-700">
                      .
                    </kbd>
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Press{" "}
                  <span className="font-semibold text-gray-700">
                    Windows Key + . (Dot)
                  </span>{" "}
                  or <span className="font-semibold text-gray-700">;</span> to
                  open emoji picker.
                </p>
              </div>
            </div>

            {/* Mac */}
            <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-base select-none mt-0.5">🍏</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-800 text-[11px]">
                    Mac (Apple)
                  </span>
                  <div className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 text-[10px] font-semibold bg-white border border-gray-300 rounded shadow-2xs text-gray-700">
                      Ctrl
                    </kbd>
                    <kbd className="px-1 py-0.5 text-[10px] font-semibold bg-white border border-gray-300 rounded shadow-2xs text-gray-700">
                      Cmd
                    </kbd>
                    <kbd className="px-1 py-0.5 text-[10px] font-semibold bg-white border border-gray-300 rounded shadow-2xs text-gray-700">
                      Space
                    </kbd>
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Press all three keys together to open Character Viewer.
                </p>
              </div>
            </div>

            {/* Mobile / Tablet */}
            <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-base select-none mt-0.5">📱</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-800 text-[11px]">
                    Mobile / Tablet
                  </span>
                  <span className="px-1.5 py-0.5 text-[11px] font-medium bg-white border border-gray-200 rounded shadow-2xs">
                    😊 icon
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Tap the smiley/emoji key directly on your touch keyboard.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Tip Footer */}
          <div className="mt-2.5 pt-2 border-t border-gray-100 text-[10px] text-gray-400 flex items-center justify-between relative z-10">
            <span>💡 Tip: You can also copy & paste any emoji</span>
          </div>
        </div>
      )}
    </span>
  );
};

export default EmojiHelpTooltip;
