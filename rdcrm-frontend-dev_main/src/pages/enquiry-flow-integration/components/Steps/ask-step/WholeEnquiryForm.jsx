import React, { useState, useEffect, useCallback } from "react";
import { useDispatch } from "react-redux";
import { OCC_GROUPS } from "../../../utils/constants";
import { axiosInstance } from "../../../../../utils/url/config";
import { fetchAllCustomers } from "../../../../../reducer/customerReducer";

const WholeEnquiryForm = ({
  client = {},
  occasion,
  setOccasion,
  occCatKey,
  setOccCatKey,
  occQuery,
  setOccQuery,
  customOccasion,
  setCustomOccasion,
  showCustomOccInput,
  setShowCustomOccInput,
  eventExactDate,
  setEventExactDate,
  eventExactTime,
  setEventExactTime,
  isNotFixed,
  setIsNotFixed,
  scope,
  setScope,
  destinationCity,
  setDestinationCity,
  destinationCountry,
  setDestinationCountry,
  neededByDate,
  setNeededByDate,
  neededByNotDecided,
  setNeededByNotDecided,
  jobCompletionDate,
  setJobCompletionDate,
  deliverToAddress,
  setDeliverToAddress,
  customShipTos,
  setCustomShipTos,
  setProductSaved,
  handleSaveAll,
  next,
  goBackToClient
}) => {
  const dispatch = useDispatch();

  // Dynamic DB Occasion Groups & Occasions
  const [occasionGroupsList, setOccasionGroupsList] = useState(OCC_GROUPS);
  const [isLoadingOccasions, setIsLoadingOccasions] = useState(false);

  const fetchDynamicOccasions = useCallback(async () => {
    try {
      setIsLoadingOccasions(true);
      const [groupsRes, occasionsRes] = await Promise.all([
        axiosInstance.get("/enquiry-masters/occasion-group/active"),
        axiosInstance.get("/enquiry-masters/occasion/active"),
      ]);

      const dbGroups = groupsRes.data?.data || [];
      const dbOccasions = occasionsRes.data?.data || [];

      if (dbGroups.length > 0) {
        const formatted = dbGroups.map((g) => {
          const items = dbOccasions
            .filter((o) => {
              const gId = o.group_id?._id || o.group_id;
              return String(gId) === String(g._id) || o.group_id?.name === g.name;
            })
            .map((o) => o.name);

          return {
            _id: g._id,
            name: g.name,
            icon: g.icon || "📁",
            items,
          };
        });

        setOccasionGroupsList(formatted);

        // If current occCatKey is not in formatted groups, default to first group
        if (!formatted.some((g) => g.name === occCatKey) && formatted[0]) {
          setOccCatKey(formatted[0].name);
        }
      }
    } catch (err) {
      console.error("Failed to load dynamic occasion groups:", err);
    } finally {
      setIsLoadingOccasions(false);
    }
  }, [occCatKey, setOccCatKey]);

  useEffect(() => {
    fetchDynamicOccasions();
  }, [fetchDynamicOccasions]);

  useEffect(() => {
    const handleInvalidate = (e) => {
      if (e.detail?.endpoint === "occasion" || e.detail?.endpoint === "occasion-group") {
        fetchDynamicOccasions();
      }
    };
    window.addEventListener("enquiry-master-invalidated", handleInvalidate);
    return () => window.removeEventListener("enquiry-master-invalidated", handleInvalidate);
  }, [fetchDynamicOccasions]);

  const totalOccasionsCount = occasionGroupsList.reduce(
    (sum, g) => sum + (g.items?.length || 0),
    0
  );

  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [newAddrName, setNewAddrName] = useState("");
  const [newAddrCity, setNewAddrCity] = useState("");
  const [newAddrPin, setNewAddrPin] = useState("");
  const [newAddrFull, setNewAddrFull] = useState("");
  const [newAddrContact, setNewAddrContact] = useState("");
  const [newAddrMobile, setNewAddrMobile] = useState("");

  const isNewAddressValid = Boolean(
    newAddrName.trim() && newAddrCity.trim() && newAddrFull.trim()
  );

  const handleSaveNewAddress = async () => {
    if (!isNewAddressValid) return;
    const newId = `sh_new_${Date.now()}`;
    const newObj = {
      id: newId,
      label: newAddrName,
      address: `${newAddrFull}, ${newAddrCity} ${newAddrPin ? `- ${newAddrPin}` : ""}`,
      city: newAddrCity,
      pin: newAddrPin,
      contact: newAddrContact,
      mobile: newAddrMobile
    };

    // Save permanently to Customer Master in MongoDB if client exists
    const clientId = client?.id || client?._id;
    if (clientId) {
      try {
        const res = await axiosInstance.post(`/customer/${clientId}/address`, {
          label: newAddrName,
          address_1: newAddrFull,
          city: newAddrCity,
          postal_code: newAddrPin || "400001",
          site_contact: newAddrContact,
          site_phone: newAddrMobile,
          is_shipping: true,
        });
        if (res.data?.newAddress?._id) {
          newObj.id = String(res.data.newAddress._id);
        }
        dispatch(fetchAllCustomers());
      } catch (err) {
        console.warn("Could not save address to customer master:", err);
      }
    }

    setCustomShipTos((prev) => [...prev, newObj]);
    setDeliverToAddress(newObj.id);

    // Reset form
    setNewAddrName("");
    setNewAddrCity("");
    setNewAddrPin("");
    setNewAddrFull("");
    setNewAddrContact("");
    setNewAddrMobile("");
    setShowNewAddressForm(false);
  };

  const allAddresses = [...(client?.shipTos || []), ...customShipTos];

  const todayStr = (() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  })();

  const eventDateInPast = Boolean(!isNotFixed && eventExactDate && eventExactDate < todayStr);
  const hasEventDateError = eventDateInPast;

  const neededByInPast = Boolean(!neededByNotDecided && neededByDate && neededByDate < todayStr);
  const neededByFailsEvent = Boolean(!neededByNotDecided && neededByDate && !isNotFixed && eventExactDate && neededByDate > eventExactDate);
  const hasNeededByError = neededByInPast || neededByFailsEvent;

  const jobDateInPast = Boolean(jobCompletionDate && jobCompletionDate < todayStr);
  const jobDateFailsDelivery = Boolean(jobCompletionDate && !neededByNotDecided && neededByDate && jobCompletionDate > neededByDate);
  const jobDateFailsEvent = Boolean(jobCompletionDate && (neededByNotDecided || !neededByDate) && !isNotFixed && eventExactDate && jobCompletionDate > eventExactDate);
  const hasJobCompletionError = jobDateInPast || jobDateFailsDelivery || jobDateFailsEvent;

  const hasDateErrors = hasEventDateError || hasJobCompletionError || hasNeededByError;
  const jobMaxDate = (!neededByNotDecided && neededByDate) 
    ? ((!isNotFixed && eventExactDate && eventExactDate < neededByDate) ? eventExactDate : neededByDate) 
    : (!isNotFixed && eventExactDate ? eventExactDate : undefined);

  const isOccasionValid = Boolean(occasion && occasion !== "+ Other...");
  const isEventValid = isNotFixed || Boolean(eventExactDate);
  const isScopeValid =
    scope === "local" ||
    ((scope === "state" || scope === "domestic") && Boolean(destinationCity.trim())) ||
    (scope === "intl" && Boolean(destinationCity.trim()) && Boolean(destinationCountry.trim()));
  const isNeededByValid = neededByNotDecided || Boolean(neededByDate);
  const isJobCompletionValid = Boolean(jobCompletionDate);
  const isAddressValid = deliverToAddress && deliverToAddress !== "choose";

  const isFormValid = isOccasionValid && isEventValid && isScopeValid && isNeededByValid && isJobCompletionValid && isAddressValid && !hasDateErrors;

  return (
    <div className="panel p-5 bg-white border border-gray-200 rounded-2xl shadow-xs space-y-6 fade">
      <div className="font-bold text-sm text-gray-900 border-b border-gray-100 pb-3">
        For the whole enquiry
      </div>

      {/* 1. Occasion Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-bold text-xs text-gray-900">Occasion</div>
          <div className="text-xs text-gray-400 font-normal">
            Corporate, milestone, fun or festival
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 outline-none focus:border-indigo-500 font-medium shadow-2xs placeholder-gray-400"
            placeholder={`Search ${totalOccasionsCount || 49} options...`}
            value={occQuery}
            onChange={(e) => setOccQuery(e.target.value)}
          />
          <span className="absolute left-3 top-3 text-xs text-gray-400">
            🔍
          </span>
        </div>

        {/* Category Chips with Count */}
        <div className="flex items-center gap-2 flex-wrap text-xs pb-1">
          {occasionGroupsList.map((cat) => {
            const isSel = occCatKey === cat.name;
            return (
              <button
                key={cat._id || cat.name}
                type="button"
                className={`px-3 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition cursor-pointer ${
                  isSel
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                    : "bg-white border-gray-200 text-gray-700 hover:bg-gray-100"
                }`}
                onClick={() => setOccCatKey(cat.name)}
              >
                <span>{cat.icon || "📁"}</span>
                <span>{cat.name}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isSel
                      ? "bg-indigo-700 text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {cat.items?.length || 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Occasion Selection Options */}
        <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
          {(() => {
            const currentGroup =
              occasionGroupsList.find((g) => g.name === occCatKey) ||
              occasionGroupsList[0] || { items: [] };
            const items = occQuery.trim()
              ? occasionGroupsList.flatMap((g) => g.items || []).filter((i) =>
                  i.toLowerCase().includes(occQuery.toLowerCase())
                )
              : (currentGroup.items || []);

            return [...items, "+ Other..."].map((opt) => {
              const isOther = opt === "+ Other...";
              const isSelected = isOther
                ? showCustomOccInput || (customOccasion && occasion === customOccasion)
                : occasion === opt && !showCustomOccInput;

              return (
                <button
                  key={opt}
                  type="button"
                  className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    isSelected
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                      : "bg-white border-gray-200 text-gray-800 hover:border-indigo-300 hover:bg-indigo-50/30"
                  }`}
                  onClick={() => {
                    if (isOther) {
                      setShowCustomOccInput(true);
                      if (customOccasion) setOccasion(customOccasion);
                    } else {
                      setShowCustomOccInput(false);
                      setOccasion(opt);
                    }
                  }}
                >
                  {isOther && customOccasion
                    ? `+ Other (${customOccasion})`
                    : opt}
                </button>
              );
            });
          })()}
        </div>

        {/* Custom Occasion Input */}
        {showCustomOccInput && (
          <div className="flex items-center gap-2 pt-2 fade">
            <input
              type="text"
              className="flex-1 px-3.5 py-2 bg-white border border-gray-300 rounded-xl text-xs text-gray-900 outline-none focus:border-indigo-500 shadow-2xs"
              placeholder="Type custom occasion..."
              value={customOccasion}
              onChange={(e) => {
                setCustomOccasion(e.target.value);
                setOccasion(e.target.value);
              }}
            />
            <button
              type="button"
              className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition cursor-pointer"
              onClick={() => setShowCustomOccInput(false)}
            >
              Save
            </button>
          </div>
        )}
      </div>

      {/* 2. When's the event? Section */}
      <div className="space-y-3 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div className="font-bold text-xs text-gray-900">
            When’s the event?
          </div>
          <button
            type="button"
            className={`px-4 py-1.5 rounded-full border text-xs font-bold transition cursor-pointer ${
              isNotFixed
                ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                : "bg-white border-gray-200 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50/30"
            }`}
            onClick={() => {
              const nextNotFixed = !isNotFixed;
              setIsNotFixed(nextNotFixed);
              if (nextNotFixed) {
                setEventExactDate("");
                setEventExactTime("");
              }
            }}
          >
            Not fixed
          </button>
        </div>

        {/* Exact date & time row */}
        <div className="space-y-1 pt-1">
          <div className="flex items-center gap-3 flex-wrap text-xs">
            <span className="text-gray-400 font-medium text-xs">exact date</span>
            <input
              type="date"
              disabled={isNotFixed}
              min={todayStr}
              className={`px-3.5 py-1.5 border rounded-xl text-xs font-medium outline-none shadow-2xs transition ${
                isNotFixed
                  ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                  : hasEventDateError
                  ? "border-red-500 focus:border-red-500 bg-red-50 text-gray-800"
                  : "bg-white border-gray-200 text-gray-800 focus:border-indigo-500"
              }`}
              value={eventExactDate}
              onChange={(e) => {
                setEventExactDate(e.target.value);
                if (e.target.value) setIsNotFixed(false);
              }}
            />
            <input
              type="time"
              disabled={isNotFixed}
              className={`px-3.5 py-1.5 border rounded-xl text-xs font-medium outline-none shadow-2xs ${
                isNotFixed
                  ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-white border-gray-200 text-gray-800 focus:border-indigo-500"
              }`}
              value={eventExactTime}
              onChange={(e) => {
                setEventExactTime(e.target.value);
                if (e.target.value) setIsNotFixed(false);
              }}
            />
          </div>
          {hasEventDateError && (
            <div className="text-red-500 text-[10px] font-semibold pl-[68px]">
              Event date cannot be in the past
            </div>
          )}
        </div>
      </div>

      {/* 3. Where is it going? Section */}
      <div className="space-y-3 pt-4 border-t border-gray-100">
        <div className="font-bold text-xs text-gray-900">
          Where is it going?
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              id: "local",
              title: "Local delivery",
              sub: "Within Mumbai / MMR",
              icon: "🏙️"
            },
            {
              id: "state",
              title: "Outstation, Maharashtra",
              sub: "Pune, Nashik, Nagpur...",
              icon: "🛣️"
            },
            {
              id: "domestic",
              title: "Other city or state",
              sub: "Anywhere else in India",
              icon: "IN",
              isTextIcon: true
            },
            {
              id: "intl",
              title: "International",
              sub: "Another country",
              icon: "🌐"
            }
          ].map((sc) => {
            const isSel = scope === sc.id;
            return (
              <button
                key={sc.id}
                type="button"
                className={`p-3.5 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                  isSel
                    ? "bg-indigo-50/70 border-2 border-indigo-600 shadow-xs"
                    : "bg-white border-gray-200 hover:border-indigo-300"
                }`}
                onClick={() => setScope(sc.id)}
              >
                <div className="space-y-0.5 pr-2">
                  <div className="font-bold text-xs text-gray-900 leading-snug flex items-center gap-1.5">
                    {sc.isTextIcon ? (
                      <span className="font-extrabold text-[11px] text-gray-700">
                        {sc.icon}
                      </span>
                    ) : (
                      <span>{sc.icon}</span>
                    )}
                    <span>{sc.title}</span>
                  </div>
                  <div className="text-[11px] text-gray-400 font-normal leading-tight">
                    {sc.sub}
                  </div>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] shrink-0 transition ${
                    isSel
                      ? "border-indigo-600 bg-indigo-600 text-white font-bold"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  {isSel ? "✓" : ""}
                </div>
              </button>
            );
          })}
        </div>

        {/* Dynamic Destination Input & Helper Subtext */}
        {scope === "local" && (
          <div className="text-xs text-gray-400 font-normal pt-1 fade">
            Delivered locally, so dispatch can go on the delivery day. Usual
            carriers: Our vehicle, Hand delivery, Porter.
          </div>
        )}

        {scope === "state" && (
          <div className="space-y-2 pt-1 fade">
            <div className="space-y-1">
              <label className="font-bold text-xs text-gray-900 block">
                Destination city / town
              </label>
              <input
                type="text"
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-xs text-gray-900 outline-none focus:border-indigo-500 font-medium shadow-2xs placeholder-gray-400"
                placeholder="e.g. Goa, Bengaluru"
                value={destinationCity}
                onChange={(ev) => setDestinationCity(ev.target.value)}
              />
            </div>
            <div className="text-xs text-gray-400 font-normal">
              Allow about 2 working days in transit; dispatch is scheduled that
              much earlier. Usual carriers: Tempo, Courier, Our vehicle.
            </div>
          </div>
        )}

        {scope === "domestic" && (
          <div className="space-y-2 pt-1 fade">
            <div className="space-y-1">
              <label className="font-bold text-xs text-gray-900 block">
                Destination city / town
              </label>
              <input
                type="text"
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-xs text-gray-900 outline-none focus:border-indigo-500 font-medium shadow-2xs placeholder-gray-400"
                placeholder="e.g. Goa, Bengaluru"
                value={destinationCity}
                onChange={(ev) => setDestinationCity(ev.target.value)}
              />
            </div>
            <div className="text-xs text-gray-400 font-normal">
              Allow about 4 working days in transit; dispatch is scheduled that
              much earlier. Usual carriers: Courier, Air cargo, Tempo.
            </div>
          </div>
        )}

        {scope === "intl" && (
          <div className="space-y-2 pt-1 fade">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-xs text-gray-900 block">
                  Destination city / town
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-xs text-gray-900 outline-none focus:border-indigo-500 font-medium shadow-2xs placeholder-gray-400"
                  placeholder="e.g. Dubai"
                  value={destinationCity}
                  onChange={(ev) => setDestinationCity(ev.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-xs text-gray-900 block">
                  Country
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-xs text-gray-900 outline-none focus:border-indigo-500 font-medium shadow-2xs placeholder-gray-400"
                  placeholder="e.g. UAE"
                  value={destinationCountry}
                  onChange={(ev) => setDestinationCountry(ev.target.value)}
                />
              </div>
            </div>
            <div className="text-xs text-gray-400 font-normal">
              Allow about 7 working days in transit; dispatch is scheduled that
              much earlier. Usual carriers: Air cargo, Courier. Export paperwork
              (invoice, packing list, HS code) will be needed.
            </div>
          </div>
        )}
      </div>

      {/* 4. Delivery Section */}
      <div className="space-y-3 pt-4 border-t border-gray-100">
        <div>
          <div className="font-bold text-xs text-gray-900">Delivery</div>
          <div className="text-[11px] text-gray-400 font-normal">
            (where and by when; can be changed at sample or production)
          </div>
        </div>

        <div className="space-y-3">
          {/* Needed by */}
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap text-xs">
              <span className="w-20 font-medium text-gray-600">Needed by</span>
              <input
                type="date"
                className={`px-3.5 py-1.5 bg-white border rounded-xl text-xs font-medium text-gray-800 outline-none shadow-2xs transition ${
                  hasNeededByError
                    ? 'border-red-500 focus:border-red-500 bg-red-50'
                    : 'border-gray-200 focus:border-indigo-500'
                }`}
                value={neededByDate}
                min={todayStr}
                max={!isNotFixed && eventExactDate ? eventExactDate : undefined}
                disabled={neededByNotDecided}
                onChange={(e) => setNeededByDate(e.target.value)}
              />
              <button
                type="button"
                className={`px-3.5 py-1.5 rounded-full border text-xs font-bold transition cursor-pointer ${
                  neededByNotDecided
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
                onClick={() => setNeededByNotDecided(!neededByNotDecided)}
              >
                Not decided
              </button>
            </div>
            {hasNeededByError && (
              <div className="text-red-500 text-[10px] font-semibold pl-[92px]">
                {neededByInPast
                  ? "Needed by date cannot be in the past"
                  : "Needed by date cannot be after the event date"}
              </div>
            )}
          </div>

          {/* Job completion date */}
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap text-xs">
              <span className="w-20 font-medium text-gray-600">
                Job completion date
              </span>
              <input
                type="date"
                className={`px-3.5 py-1.5 bg-white border rounded-xl text-xs font-medium text-gray-800 outline-none shadow-2xs transition ${
                  hasJobCompletionError
                    ? 'border-red-500 focus:border-red-500 bg-red-50'
                    : 'border-gray-200 focus:border-indigo-500'
                }`}
                value={jobCompletionDate}
                min={todayStr}
                max={jobMaxDate}
                onChange={(e) => setJobCompletionDate(e.target.value)}
              />
            </div>
            {hasJobCompletionError && (
              <div className="text-red-500 text-[10px] font-semibold pl-[92px]">
                {jobDateInPast
                  ? "Job completion date cannot be in the past"
                  : jobDateFailsDelivery
                  ? "Job completion date cannot be after the needed by date"
                  : "Job completion date cannot be after the event date"}
              </div>
            )}
          </div>

          {/* Deliver to */}
          <div className="flex items-center gap-3 flex-wrap text-xs">
            <span className="w-20 font-medium text-gray-600">Deliver to</span>
            <select
              className="px-3.5 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 outline-none focus:border-indigo-500 shadow-2xs cursor-pointer min-w-[200px]"
              value={deliverToAddress}
              onChange={(e) => setDeliverToAddress(e.target.value)}
            >
              <option value="choose">Choose address...</option>
              {allAddresses.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.label} - {st.address}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="text-indigo-600 hover:text-indigo-800 font-bold text-xs cursor-pointer transition"
              onClick={() => setShowNewAddressForm(!showNewAddressForm)}
            >
              + New address
            </button>
          </div>

          {/* Inline New Address Form (Matching User Screenshot 100%) */}
          {showNewAddressForm && (
            <div className="p-4 bg-[#F8F7FF] border border-indigo-100 rounded-2xl space-y-3.5 shadow-xs fade mt-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[11px] text-gray-700 block">
                    Name for this address
                  </label>
                  <input
                    type="text"
                    className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 outline-none focus:border-indigo-500 placeholder-gray-400 font-medium shadow-2xs"
                    placeholder="e.g. Igatpuri resort"
                    value={newAddrName}
                    onChange={(e) => setNewAddrName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[11px] text-gray-700 block">
                    City / town
                  </label>
                  <input
                    type="text"
                    className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 outline-none focus:border-indigo-500 font-medium shadow-2xs"
                    placeholder="e.g. Goa, Bengaluru"
                    value={newAddrCity}
                    onChange={(e) => setNewAddrCity(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[11px] text-gray-700 block">
                    PIN code
                  </label>
                  <input
                    type="text"
                    className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 outline-none focus:border-indigo-500 font-medium shadow-2xs"
                    placeholder="e.g. 400001"
                    value={newAddrPin}
                    onChange={(e) => setNewAddrPin(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[11px] text-gray-700 block">
                  Full address
                </label>
                <textarea
                  rows={2}
                  className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 outline-none focus:border-indigo-500 placeholder-gray-400 font-medium shadow-2xs"
                  placeholder="Building, street, landmark"
                  value={newAddrFull}
                  onChange={(e) => setNewAddrFull(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[11px] text-gray-700 block">
                    Contact at site <span className="font-normal italic text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 outline-none focus:border-indigo-500 font-medium shadow-2xs"
                    value={newAddrContact}
                    onChange={(e) => setNewAddrContact(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[11px] text-gray-700 block">
                    Site mobile <span className="font-normal italic text-gray-400">(optional)</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-gray-500">+91</span>
                    <input
                      type="text"
                      className="flex-1 px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 outline-none focus:border-indigo-500 font-medium shadow-2xs"
                      value={newAddrMobile}
                      onChange={(e) => setNewAddrMobile(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1 flex-wrap">
                <button
                  type="button"
                  className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-600 bg-white hover:bg-gray-50 cursor-pointer"
                  onClick={() => setShowNewAddressForm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!isNewAddressValid}
                  className={`px-5 py-2 font-bold rounded-xl text-xs transition cursor-pointer shadow-2xs ${
                    isNewAddressValid
                      ? "bg-[#FCE6A9] hover:bg-[#f6dc98] text-gray-800"
                      : "bg-amber-100/60 text-gray-400 cursor-not-allowed opacity-60"
                  }`}
                  onClick={handleSaveNewAddress}
                >
                  Save and deliver here
                </button>
                <span className="text-[11px] text-gray-400 font-normal">
                  Name, full address and city are needed.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Footer */}
      <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
        <button
          type="button"
          className="px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs rounded-xl border border-gray-300 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
          onClick={goBackToClient}
        >
          <span>←</span>
          <span>Back</span>
        </button>

        <button
          type="button"
          disabled={!isFormValid}
          className={`px-6 py-2.5 rounded-xl text-xs font-bold shadow-md transition flex items-center gap-2 ${
            !isFormValid
              ? "opacity-50 cursor-not-allowed"
              : "cursor-pointer hover:opacity-95"
          }`}
          style={{ backgroundColor: "#635BFF", color: "#ffffff" }}
          onClick={() => {
            if (!isFormValid) return;
            handleSaveAll();
            next();
          }}
        >
          <span>Next: the brief</span>
        </button>
      </div>
    </div>
  );
};

export default WholeEnquiryForm;
