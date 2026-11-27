import React, { useState } from "react";
import { CARRIERS, carrierOf, delivWhere, dfmt, todayISO } from "../../utils/helpers";

const DispatchPanel = ({ s = {}, set, client = {}, ids = {} }) => {
  const dv = s.deliv || {
    carrier: "Tempo",
    payer: "rd",
    when: "office hours",
    shipTo: "Lonavala offsite venue"
  };

  const carrier = dv.carrier || carrierOf(dv.mode) || "Tempo";
  const isRoad = ["Our vehicle", "Tempo", "Porter", "Hand delivery"].includes(carrier);

  const [isAddressConfirmed, setIsAddressConfirmed] = useState(
    s.addressConfirmed !== undefined ? s.addressConfirmed : false
  );
  const [isChangingAddress, setIsChangingAddress] = useState(false);
  const [tempShipTo, setTempShipTo] = useState(dv.shipTo || "Lonavala offsite venue");

  const [date, setDate] = useState(todayISO());
  const [carrierSel, setCarrierSel] = useState(carrier);
  const [docket, setDocket] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [driver, setDriver] = useState("");
  const [phone, setPhone] = useState("");
  const [boxes, setBoxes] = useState("");
  const [eway, setEway] = useState("");

  const parentJobNo = s?.seq
    ? String(s.seq).startsWith("RD")
      ? s.seq
      : `RD${s.seq}`
    : (ids?.enq?.startsWith("RD") ? ids.enq : ids?.enq?.replace("ENQ/26/", "RD")) || "RD/P/26/0415";

  const isPackingListPending = !s.packingListStatus || s.packingListStatus !== "received";

  const handleConfirmAddress = () => {
    setIsAddressConfirmed(true);
    set({ addressConfirmed: true });
  };

  const handleSaveDispatch = () => {
    set({
      dispatched: {
        date,
        carrier: carrierSel,
        docket: isRoad ? "" : docket,
        vehicle: isRoad ? vehicle : "",
        driver: isRoad ? driver : "",
        phone: isRoad ? phone : "",
        boxes,
        eway,
        at: new Date().toISOString()
      },
      pickedAt: date
    });
  };

  return (
    <div className="space-y-4 text-left">
      {/* Main Goods out card (Screenshot 1) */}
      <div className="w-full bg-white border border-gray-200 rounded-2xl p-6 sm:p-7 shadow-xs space-y-6 text-xs">
        {/* Header */}
        <div className="flex items-start gap-3 pb-2">
          <span className="text-2xl mt-0.5">🚚</span>
          <div>
            <h4 className="font-black text-base text-gray-900 tracking-tight">
              Goods out · dispatch details
            </h4>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Artwork approved and production done. Re-confirm the address set earlier, mark packed, then upload the dispatch details.
            </p>
          </div>
        </div>

        {/* 1 · Address */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-gray-800">
            1 · Address
          </div>

          <div className="border border-gray-200/90 rounded-2xl p-4 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="text-rose-500 text-base mt-0.5">📍</span>
              <div>
                <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">
                  Confirm before packing
                </span>
                <b className="text-xs font-extrabold text-gray-900 block mt-0.5">
                  {dv.shipTo || "Lonavala offsite venue"}
                </b>
                <span className="text-[11px] text-gray-500 font-medium block mt-0.5">
                  {carrier}, {dv.payer === "client" ? "client pays" : "we pay"} · {dv.when || "office hours"} · by Sat, 24 Oct
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {!isAddressConfirmed ? (
                <button
                  type="button"
                  onClick={handleConfirmAddress}
                  className="px-6 py-2 bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold rounded-xl text-xs shadow-2xs transition cursor-pointer"
                >
                  Confirm
                </button>
              ) : (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
                  Confirmed ✓
                </span>
              )}
              <button
                type="button"
                onClick={() => setIsChangingAddress(!isChangingAddress)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
              >
                Change
              </button>
            </div>
          </div>

          {isChangingAddress && (
            <div className="p-3 bg-white border border-gray-200 rounded-xl space-y-2 mt-2">
              <label className="text-[11px] font-bold text-gray-700 block">
                Update delivery address:
              </label>
              <input
                type="text"
                className="w-full p-2 text-xs border border-gray-300 rounded-lg outline-none"
                value={tempShipTo}
                onChange={(e) => setTempShipTo(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsChangingAddress(false)}
                  className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    set({ deliv: { ...dv, shipTo: tempShipTo } });
                    setIsChangingAddress(false);
                  }}
                  className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold"
                >
                  Save Address
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 2 · Packed */}
        <div className="space-y-3 pt-2">
          <div className="text-xs font-bold text-gray-800">
            2 · Packed
          </div>

          {/* Packing list not received alert box (if applicable) */}
          {isPackingListPending && !s.packedAt && (
            <div className="p-3.5 bg-[#FFF5F5] border border-[#FED7D7] rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  !
                </span>
                <div>
                  <b className="text-xs font-bold text-gray-900 block">
                    Packing list not received
                  </b>
                  <span className="text-[11px] text-rose-700 font-medium block">
                    Needed for individual + alphabetical
                  </span>
                </div>
              </div>
              <label className="px-5 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-bold rounded-xl text-xs shadow-2xs transition cursor-pointer shrink-0">
                Upload
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      set({
                        packingListStatus: "received",
                        packingListFileName: f.name
                      });
                    }
                  }}
                />
              </label>
            </div>
          )}

          {/* PP Sample hold notice */}
          {s.ppAfter && !s.ppApproved && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  !
                </span>
                <div>
                  <b className="text-xs font-bold text-amber-950 block">
                    Pre-production sample approval pending
                  </b>
                  <span className="text-[11px] text-amber-800 font-medium block">
                    Bulk packing holds until client signs off on test piece
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => set({ ppApproved: true, ppApprovedAt: new Date().toISOString() })}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-2xs transition cursor-pointer shrink-0"
              >
                Approve PP
              </button>
            </div>
          )}

          {/* Mark packed today button */}
          {!s.packedAt ? (
            <div className="pt-1">
              <button
                type="button"
                disabled={!isAddressConfirmed}
                onClick={() => set({ packedAt: todayISO() })}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition ${
                  isAddressConfirmed
                    ? "bg-amber-400 hover:bg-amber-500 text-amber-950 shadow-2xs cursor-pointer"
                    : "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
                }`}
              >
                Mark packed today
              </button>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
                  ✓
                </span>
                <div>
                  <b className="text-xs font-bold text-gray-900">
                    Packed on {dfmt(s.packedAt)}
                  </b>
                  <span className="text-[11px] text-emerald-800 font-medium block">
                    Packed according to specifications
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => set({ packedAt: null })}
                className="text-[11px] font-bold text-gray-400 hover:text-gray-600 underline cursor-pointer"
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {/* 3 · Dispatch details */}
        <div className="space-y-3 pt-2">
          <div className="text-xs font-bold text-gray-800">
            3 · Dispatch details
          </div>

          {!s.packedAt ? (
            <div className="text-[11px] text-gray-400 font-medium py-1">
              Available once it's packed.
            </div>
          ) : s.dispatched ? (
            <div className="p-4 bg-emerald-50/70 border border-emerald-300 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
                    ✓
                  </span>
                  <div>
                    <b className="text-xs font-bold text-gray-900">
                      Dispatched {dfmt(s.dispatched.date)} · {s.dispatched.carrier}
                    </b>
                    <p className="text-[11px] text-gray-600">
                      {[
                        s.dispatched.docket && `AWB / Docket: ${s.dispatched.docket}`,
                        s.dispatched.vehicle && `Vehicle: ${s.dispatched.vehicle}`,
                        s.dispatched.driver && `Driver: ${s.dispatched.driver}`,
                        s.dispatched.boxes && `${s.dispatched.boxes} boxes`,
                        s.dispatched.eway && `E-Way: ${s.dispatched.eway}`
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => set({ dispatched: null })}
                  className="text-xs font-bold text-gray-500 hover:text-gray-700 underline cursor-pointer"
                >
                  Edit
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl space-y-3.5">
              <h5 className="font-bold text-gray-800 text-xs">
                Enter dispatch & tracking information
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-gray-600 block mb-1">
                    Dispatch Date
                  </label>
                  <input
                    type="date"
                    className="w-full p-2 text-xs border border-gray-300 rounded-xl bg-white outline-none"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-600 block mb-1">
                    Carrier
                  </label>
                  <select
                    className="w-full p-2 text-xs border border-gray-300 rounded-xl bg-white outline-none"
                    value={carrierSel}
                    onChange={(e) => setCarrierSel(e.target.value)}
                  >
                    {CARRIERS.map((c) => (
                      <option key={c.v} value={c.v}>
                        {c.v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-600 block mb-1">
                    {isRoad ? "Vehicle Number" : "Docket / AWB No."}
                  </label>
                  <input
                    type="text"
                    placeholder={isRoad ? "e.g. MH 02 AB 1234" : "e.g. DTDC8912384"}
                    className="w-full p-2 text-xs border border-gray-300 rounded-xl bg-white outline-none"
                    value={isRoad ? vehicle : docket}
                    onChange={(e) => (isRoad ? setVehicle(e.target.value) : setDocket(e.target.value))}
                  />
                </div>
                {isRoad && (
                  <>
                    <div>
                      <label className="text-[11px] font-bold text-gray-600 block mb-1">
                        Driver Name
                      </label>
                      <input
                        type="text"
                        className="w-full p-2 text-xs border border-gray-300 rounded-xl bg-white outline-none"
                        value={driver}
                        onChange={(e) => setDriver(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-600 block mb-1">
                        Driver Mobile
                      </label>
                      <input
                        type="text"
                        className="w-full p-2 text-xs border border-gray-300 rounded-xl bg-white outline-none"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="text-[11px] font-bold text-gray-600 block mb-1">
                    Total Boxes
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 4"
                    className="w-full p-2 text-xs border border-gray-300 rounded-xl bg-white outline-none"
                    value={boxes}
                    onChange={(e) => setBoxes(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-600 block mb-1">
                    E-way Bill No. (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 28192837192"
                    className="w-full p-2 text-xs border border-gray-300 rounded-xl bg-white outline-none"
                    value={eway}
                    onChange={(e) => setEway(e.target.value)}
                  />
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  className="px-5 py-2.5 bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold rounded-xl shadow-2xs transition cursor-pointer"
                  disabled={isRoad ? !vehicle.trim() : !docket.trim()}
                  onClick={handleSaveDispatch}
                >
                  Save dispatch details
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cancel Order Link matching bottom of Screenshot 1 */}
      <div>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Are you sure the client wants to cancel this order?")) {
              set({ abandoned: true });
            }
          }}
          className="text-xs text-gray-400 hover:text-rose-600 font-medium cursor-pointer"
        >
          Client wants to cancel the whole order...
        </button>
      </div>

      {/* Green Hub Confirmation Banner matching bottom of Screenshot 1 */}
      <div className="bg-[#EBFBF4] border border-[#A7E8C5] rounded-2xl p-4 flex items-center gap-3 shadow-2xs">
        <span className="w-5 h-5 rounded-full bg-[#10B981] text-white flex items-center justify-center font-bold text-xs shrink-0">
          ✓
        </span>
        <span className="text-xs font-bold text-[#065F46]">
          {parentJobNo} is with the Production Hub: {s.orderItems?.length || 2} items, {s.finalQty || 140} pcs, delivery Sat, 24 Oct.
        </span>
      </div>
    </div>
  );
};

export default DispatchPanel;
