import React, { useRef } from "react";

/**
 * PastOrdersCarousel
 * Displays horizontal scrolling cards of previous orders for the selected client.
 * Allows quick one-click pre-fill of design theme, size, and rate.
 */
const PastOrdersCarousel = ({
  pastOrders = [],
  selectedTheme = "",
  onSelectReorder = () => {},
}) => {
  const scrollRef = useRef(null);

  if (!Array.isArray(pastOrders) || pastOrders.length === 0) {
    return null;
  }

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = 260;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-xs font-bold text-gray-700 flex items-center justify-between">
        <span>Past orders for this client</span>
        <span className="text-[11px] text-gray-400 font-normal">
          Click to pre-fill
        </span>
      </div>

      <div className="relative flex items-center">
        <button
          type="button"
          onClick={() => scroll("left")}
          title="Previous"
          aria-label="Previous past orders"
          className="w-7 h-7 rounded-full bg-white border border-gray-300 hover:bg-gray-100 active:scale-90 flex items-center justify-center text-xs font-bold shrink-0 text-gray-600 mr-2 shadow-xs cursor-pointer transition"
        >
          ◀
        </button>

        <div
          ref={scrollRef}
          className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none flex-1 scroll-smooth"
        >
          {pastOrders.map((po, pIdx) => {
            const colorClasses =
              po.iconColor ||
              (pIdx % 3 === 0
                ? "text-purple-600 bg-purple-100"
                : pIdx % 3 === 1
                ? "text-red-600 bg-red-100"
                : "text-emerald-600 bg-emerald-100");
            const isSelected = selectedTheme === po.name;

            return (
              <button
                key={pIdx}
                type="button"
                className={`p-3 rounded-2xl border text-left transition shrink-0 flex items-center gap-3 cursor-pointer ${
                  isSelected
                    ? "bg-indigo-50 border-indigo-600 shadow-sm"
                    : "bg-white border-gray-200 hover:border-indigo-300"
                }`}
                onClick={() => onSelectReorder(po)}
              >
                <span
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${colorClasses}`}
                >
                  🏆
                </span>
                <div>
                  <div className="font-bold text-xs text-gray-900">
                    {po.name}
                  </div>
                  <div className="text-[10px] text-gray-400 font-medium mt-0.5">
                    Reorder · {po.month} · {po.size} in · ₹
                    {Number(po.rate).toLocaleString()}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => scroll("right")}
          title="Next"
          aria-label="Next past orders"
          className="w-7 h-7 rounded-full bg-white border border-gray-300 hover:bg-gray-100 active:scale-90 flex items-center justify-center text-xs font-bold shrink-0 text-gray-600 ml-2 shadow-xs cursor-pointer transition"
        >
          ▶
        </button>
      </div>

      {/* Scroll track indicator */}
      <div className="w-52 mx-auto h-1.5 bg-gray-200/80 rounded-full overflow-hidden">
        <div className="w-16 h-full bg-gray-400/80 rounded-full"></div>
      </div>
    </div>
  );
};

export default PastOrdersCarousel;

