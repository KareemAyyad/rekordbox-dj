"use client";

import { useEffect, useCallback } from "react";
import clsx from "clsx";
import { toast } from "sonner";
import { useLibraryStore } from "@/stores/library-store";
import { api } from "@/lib/api-client";
import type { LibraryItem } from "@/lib/types";

function LibraryItemRow({ item }: { item: LibraryItem }) {
  const dateStr = item.downloaded_at
    ? new Date(item.downloaded_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <div className="dc-animate-fadeIn flex items-center justify-between gap-4 rounded-xl border border-[color:var(--dc-border)] bg-[var(--dc-card)] px-4 py-3 shadow-sm hover:shadow-md transition">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--dc-text)]">{item.title || "Untitled"}</p>
        <p className="truncate text-xs text-[var(--dc-muted)]">{item.artist || "Unknown Artist"}</p>
        <div className="mt-1.5 flex items-center gap-2">
          {item.genre && item.genre !== "Other" && (
            <span className="rounded-full bg-[var(--dc-accent-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--dc-accent-text)]">
              {item.genre}
            </span>
          )}
          {item.energy && (
            <span className="rounded-full bg-[var(--dc-warning-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--dc-warning-text)]">
              {item.energy}
            </span>
          )}
          {dateStr && (
            <span className="text-[10px] text-[var(--dc-muted2)]">{dateStr}</span>
          )}
        </div>
      </div>
      <a
        href={item.download_url}
        download
        className="shrink-0 rounded-lg bg-[var(--dc-accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition"
      >
        Download
      </a>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-[color:var(--dc-border)] bg-[var(--dc-card)] px-4 py-3">
      <div className="flex-1 space-y-2">
        <div className="dc-skeleton h-4 w-48" />
        <div className="dc-skeleton h-3 w-32" />
        <div className="dc-skeleton h-3 w-20 mt-1" />
      </div>
      <div className="dc-skeleton h-8 w-20 rounded-lg" />
    </div>
  );
}

export default function LibraryPage() {
  const items = useLibraryStore((s) => s.items);
  const loading = useLibraryStore((s) => s.loading);
  const error = useLibraryStore((s) => s.error);
  const search = useLibraryStore((s) => s.search);
  const sort = useLibraryStore((s) => s.sort);
  const setItems = useLibraryStore((s) => s.setItems);
  const setLoading = useLibraryStore((s) => s.setLoading);
  const setError = useLibraryStore((s) => s.setError);
  const setSearch = useLibraryStore((s) => s.setSearch);
  const setSort = useLibraryStore((s) => s.setSort);

  const loadLibrary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getLibrary(search, sort);
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load library");
      toast.error("Failed to load library");
    }
  }, [search, sort, setItems, setLoading, setError]);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  // Client-side filter for instant search
  const query = search.toLowerCase().trim();
  const filtered = query
    ? items.filter(
        (i) =>
          i.artist.toLowerCase().includes(query) ||
          i.title.toLowerCase().includes(query) ||
          i.genre.toLowerCase().includes(query)
      )
    : items;

  return (
    <div className="rounded-3xl border border-[color:var(--dc-border)] bg-[var(--dc-card)] p-6 shadow-[var(--dc-shadow)]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--dc-text)]">Library</h1>
          <p className="mt-1 text-sm text-[var(--dc-muted)]">Your downloaded tracks</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadLibrary}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl bg-[var(--dc-chip)] px-3 py-1.5 text-xs font-medium text-[var(--dc-muted)] hover:bg-[var(--dc-chip-strong)] transition"
          >
            <svg className={clsx("h-3.5 w-3.5", loading && "dc-animate-spin")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <span className="rounded-full bg-[var(--dc-chip)] px-2.5 py-1 text-[10px] font-semibold uppercase text-[var(--dc-muted)]">
            {items.length} Track{items.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="dc-animate-fadeIn mt-4 rounded-2xl border border-[color:var(--dc-danger-border)] bg-[var(--dc-danger-bg)] px-4 py-3">
          <p className="text-sm text-[var(--dc-danger-text)]">{error}</p>
        </div>
      )}

      {/* Search & Sort */}
      {!loading && items.length > 0 && (
        <div className="dc-animate-fadeIn mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dc-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Search by artist, title, or genre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[color:var(--dc-border)] bg-[var(--dc-input)] pl-10 pr-4 py-2 text-sm text-[var(--dc-text)] placeholder-[var(--dc-muted2)] focus:border-[var(--dc-accent)] focus:ring-2 focus:ring-[var(--dc-accent-ring)] focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--dc-muted)]">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as "date" | "artist" | "title")}
              className="rounded-xl border border-[color:var(--dc-border)] bg-[var(--dc-input)] px-3 py-2 text-xs text-[var(--dc-text)] focus:border-[var(--dc-accent)] focus:outline-none"
            >
              <option value="date">Date Added</option>
              <option value="artist">Artist</option>
              <option value="title">Title</option>
            </select>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="mt-6 space-y-3">
        {loading ? (
          <>
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </>
        ) : items.length === 0 ? (
          <div className="dc-animate-fadeIn flex flex-col items-center justify-center py-16">
            <svg className="h-16 w-16 text-[var(--dc-muted2)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.8}>
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v7M12 15v7M2 12h7M15 12h7" strokeWidth={0.3} />
            </svg>
            <h3 className="mt-4 text-sm font-semibold text-[var(--dc-text)]">No tracks yet</h3>
            <p className="mt-1 text-xs text-[var(--dc-muted)]">
              Download some tracks from the Queue tab to see them here
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="dc-animate-fadeIn flex flex-col items-center justify-center py-12">
            <p className="text-sm font-medium text-[var(--dc-text)]">No results</p>
            <p className="mt-1 text-xs text-[var(--dc-muted)]">
              No tracks match &quot;{search}&quot;
            </p>
          </div>
        ) : (
          filtered.map((item) => <LibraryItemRow key={item.id} item={item} />)
        )}
      </div>
    </div>
  );
}
