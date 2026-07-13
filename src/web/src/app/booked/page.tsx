"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import BookingSegment from "@/components/BookingSegment";
import { BookingDetail } from "@/types/flight";

const BookedPage = () => {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      try {
        const path = window.location.pathname + window.location.search;
        router.replace(`/login?redirect=${encodeURIComponent(path)}`);
      } catch {
        router.replace(`/login`);
      }
    }
  }, [isAuthenticated, authLoading, router]);

  const [bookings] = useState<BookingDetail[]>(() => {
    try {
      const raw =
        typeof window !== "undefined"
          ? window.localStorage.getItem("bookings")
          : null;
      if (!raw) return [];
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr.filter(
        (b): b is BookingDetail =>
          b &&
          typeof b === "object" &&
          "ref" in b &&
          "outboundFlight" in b &&
          "fromAirport" in b
      );
    } catch {
      return [];
    }
  });

  const mine = useMemo(() => {
    if (!user) return [] as BookingDetail[];
    return bookings.filter((b) => b.user?.username === user.username);
  }, [bookings, user]);

  const ordered = useMemo(
    () => [...mine].sort((a, b) => a.createdAt - b.createdAt),
    [mine]
  );

  if (authLoading) {
    return (
      <section className="w-full md:pt-16 pb-4 md:pb-10 px-5 sm:px-8">
        <div className="max-w-6xl mx-auto mb-6">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight">
            Your bookings
          </h1>
          <p className="text-sm text-gray-600 mt-1">Loading bookings...</p>
        </div>
      </section>
    );
  }

  if (!isAuthenticated) return null;

  if (ordered.length === 0) {
    return (
      <section className="w-full md:pt-16 pb-4 md:pb-10 px-5 sm:px-8">
        <div className="max-w-6xl mx-auto mb-6">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight">
            Your bookings
          </h1>
          <p className="text-sm text-gray-600 mt-1 mb-6">
            You have no saved bookings yet for this user.
          </p>
          <div className="mx-auto w-full max-w-6xl rounded-3xl bg-gray-50 ring-1 ring-gray-200 shadow-sm px-5 sm:px-6 py-8 flex flex-col items-start gap-4">
            <p className="text-sm text-gray-600">
              Start by creating your first itinerary.
            </p>
            <a
              href="/book"
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-7 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              Start booking
            </a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full md:pt-16 pb-4 md:pb-10 px-5 sm:px-8">
      <div className="max-w-6xl mx-auto mb-6">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight">
          Your bookings
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          A history of flights you&apos;ve booked in this browser.
        </p>
      </div>
      <div className="mx-auto w-full max-w-6xl rounded-3xl bg-gray-50 ring-1 ring-gray-200 shadow-sm px-5 sm:px-6 py-6 md:py-7">
        <ul className="space-y-8">
          {ordered.map((b: BookingDetail) => {
            const {
              ref,
              createdAt,
              passengers,
              total,
              outboundFlight,
              inboundFlight,
            } = b;
            return (
              <li
                key={ref}
                className="rounded-2xl ring-1 ring-gray-200 bg-white/80 backdrop-blur px-5 py-5 shadow-sm"
              >
                <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
                  <div>
                    <p className="text-[10px] font-semibold tracking-wider text-gray-500 uppercase">
                      Reference
                    </p>
                    <p className="font-mono font-bold text-lg mt-0.5">{ref}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">
                      Total
                    </p>
                    <p className="font-semibold text-base">
                      $
                      {total.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      {passengers}{" "}
                      {passengers === 1 ? "passenger" : "passengers"} •{" "}
                      {new Date(createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="space-y-5">
                  <BookingSegment label="OUTBOUND" flight={outboundFlight} />
                  {inboundFlight && (
                    <BookingSegment label="RETURN" flight={inboundFlight} />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};

export default BookedPage;
