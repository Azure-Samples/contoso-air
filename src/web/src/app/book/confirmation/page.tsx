"use client";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Flight, BookingDetail } from "@/types/flight";
import { hashSeat } from "@/utils/mockBookingGenerator";
import { useAuth } from "@/components/AuthProvider";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ConfirmationPage = () => {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const persisted = useMemo<BookingDetail | null>(() => {
    try {
      const raw =
        typeof window !== "undefined"
          ? window.localStorage.getItem("bookings")
          : null;
      if (!raw) return null;
      const arr = JSON.parse(raw) as unknown;
      if (!Array.isArray(arr)) return null;
      const candidate = arr.filter((b): b is BookingDetail => {
        return (
          b &&
          typeof b === "object" &&
          "ref" in b &&
          "outboundFlight" in b &&
          "fromAirport" in b
        );
      });
      const filtered = user
        ? candidate.filter((b) => b.user?.username === user.username)
        : candidate;
      if (!filtered.length) return null;
      filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return filtered[0];
    } catch {
      return null;
    }
  }, [user]);

  useEffect(() => {
    try {
      window.localStorage.removeItem("bookingSelection");
    } catch {}
  }, []);
  const passengers = persisted?.passengers || 1;

  // Use persisted flights if available; otherwise fallback to context
  const displayOutbound: Flight | undefined = persisted?.outboundFlight;
  const displayInbound: Flight | null | undefined =
    persisted?.inboundFlight ?? null;
  const effectiveBookingRef = persisted?.ref || "PENDING";
  const total =
    persisted?.total ||
    ((displayOutbound?.price || 0) +
      (displayInbound ? displayInbound.price : 0)) *
      passengers;

  if (authLoading) {
    return <p className="p-6 text-sm text-gray-500">Loading booking...</p>;
  }
  if (!isAuthenticated) {
    if (typeof window !== "undefined") {
      const path = window.location.pathname + window.location.search;
      router.replace(`/login?redirect=${encodeURIComponent(path)}`);
    }
    return null;
  }
  if (!displayOutbound) {
    return (
      <p className="p-6 text-sm text-red-600">
        Booking not found.{" "}
        <button className="underline" onClick={() => router.push("/book")}>
          Start over
        </button>
      </p>
    );
  }

  return (
    <section className="w-full md:pt-16 pb-4 md:pb-10 px-5 sm:px-8">
      <div className="max-w-6xl mx-auto mb-6">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight">
          Booking confirmed
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Your reservation is complete. A confirmation email will arrive
          shortly.
        </p>
      </div>
      <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6 items-start">
        <div className="md:col-span-2 space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white/70 backdrop-blur p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider font-semibold text-gray-500">
                  Booking reference
                </p>
                <p className="text-lg font-mono font-bold mt-0.5 flex items-center gap-2">
                  <span>{effectiveBookingRef}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Total paid</p>
                <p className="text-lg font-semibold">
                  $
                  {total.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
            <div className="mt-6 divide-y divide-gray-200">
              {[displayOutbound, displayInbound]
                .filter(Boolean)
                .map((f, idx) => {
                  const flight = f!;
                  return (
                    <div
                      key={flight.id}
                      className={`py-5 ${idx === 0 ? "" : ""}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold tracking-wider text-gray-500">
                          {flight.direction === "outbound"
                            ? "OUTBOUND"
                            : "RETURN"}
                        </p>
                        <p className="text-xs text-gray-500">
                          Seat:{" "}
                          <span className="font-medium">
                            {hashSeat(flight.id)}
                          </span>
                        </p>
                      </div>
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-5">
                          <p className="text-3xl font-extrabold leading-none">
                            {flight.from.code}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            {flight.from.city}, {flight.from.state}
                          </p>
                          <p className="text-sm font-medium mt-2">
                            {formatTime(flight.depart)}
                          </p>
                        </div>
                        <div
                          className="col-span-2 flex items-center justify-center"
                          aria-hidden
                        >
                          →
                        </div>
                        <div className="col-span-5 text-right">
                          <p className="text-3xl font-extrabold leading-none">
                            {flight.to.code}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            {flight.to.city}, {flight.to.state}
                          </p>
                          <p className="text-sm font-medium mt-2">
                            {formatTime(flight.arrive)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                try {
                  // Remove only the booking being viewed
                  const raw = window.localStorage.getItem("bookings");
                  if (raw && persisted?.ref) {
                    const arr = JSON.parse(raw);
                    if (Array.isArray(arr)) {
                      const next = (arr as unknown[]).filter((b) => {
                        if (!b || typeof b !== "object") return true;
                        const candidate = b as {
                          ref?: string;
                          record?: { ref?: string };
                        };
                        if (candidate.ref)
                          return candidate.ref !== persisted.ref;
                        if (candidate.record?.ref)
                          return candidate.record.ref !== persisted.ref;
                        return true;
                      });
                      window.localStorage.setItem(
                        "bookings",
                        JSON.stringify(next)
                      );
                    }
                  }
                } catch {}
                router.push("/");
              }}
              className="rounded-lg border border-gray-300 bg-white text-sm font-medium px-4 py-2.5 hover:bg-gray-50"
            >
              Home
            </button>
            <button
              onClick={() => {
                try {
                  // Keep other bookings; just navigate to booking flow
                } catch {}
                router.push("/book");
              }}
              className="rounded-lg bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 shadow-sm hover:bg-blue-700"
            >
              Book another
            </button>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white/70 backdrop-blur p-5 shadow-sm h-max">
          <h2 className="text-base font-semibold mb-4">Receipt</h2>
          <ul className="text-xs text-gray-600 space-y-2 mb-4">
            <li className="flex justify-between">
              <span>Base fare</span>
              <span>
                $
                {(total * 0.85).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </li>
            <li className="flex justify-between">
              <span>Taxes & fees</span>
              <span>
                $
                {(total * 0.15).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </li>
            <li className="flex justify-between font-semibold text-gray-800 border-t pt-2">
              <span>Total paid</span>
              <span>
                $
                {total.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </li>
          </ul>
          <p className="text-[11px] leading-relaxed text-gray-500">
            Your credit card was not really charged. This is a demo app 😉
          </p>
        </div>
      </div>
    </section>
  );
};

export default ConfirmationPage;
