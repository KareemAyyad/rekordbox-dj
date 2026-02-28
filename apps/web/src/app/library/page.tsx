"use client";

import { useEffect, useCallback } from "react";
import clsx from "clsx";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import type { Variants } from "framer-motion";
import { Download, RefreshCw, FileAudio, Search, Disc3, Zap, Clock } from "lucide-react";
import { useLibraryStore } from "@/stores/library-store";
import { api } from "@/lib/api-client";
import type { LibraryItem } from "@/lib/types";

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 400, damping: 25 } },
  exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } }
};

function LibraryItemRow({ item }: { item: LibraryItem }) {
  const dateStr = item.downloaded_at
    ? new Date(item.downloaded_at).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    : "";

  return (
    <motion.li
      variants={itemVariants}
      layout="position"
      className="dc-glass hover:dc-glass-strong flex items-center justify-between gap-4 rounded-2xl p-4 transition-all duration-300 list-none group"
    >
      <div className="min-w-0 flex-1 flex flex-col justify-center">
        <p className="truncate text-sm font-bold text-[var(--dc-text)] leading-tight">{item.title || "Untitled"}</p>
        <p className="truncate text-xs font-medium text-[var(--dc-muted)] mt-0.5">{item.artist || "Unknown Artist"}</p>

        <div className="mt-3 flex flex-wrap gap-2">
          {item.genre && item.genre !== "Other" && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--dc-chip)] px-2.5 py-1 text-[10px] font-bold text-[var(--dc-text)] border border-[var(--dc-border)]">
              <Disc3 className="w-3 h-3 text-[var(--dc-accent-text)]" />
              {item.genre}
            </span>
          )}
          {item.energy && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--dc-chip)] px-2.5 py-1 text-[10px] font-bold text-[var(--dc-text)] border border-[var(--dc-border)]">
              <Zap className="w-3 h-3 text-[var(--dc-warning-text)]" />
              {item.energy}
            </span>
          )}
          {dateStr && (
            <span className="inline-flex items-center gap-1.5 rounded-md text-[10px] font-medium text-[var(--dc-muted2)] ml-auto">
              <Clock className="w-3 h-3" />
              {dateStr}
            </span>
          )}
        </div>
      </div>

      <motion.a
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        href={item.download_url}
        download
        className="shrink-0 flex items-center justify-center p-3 rounded-xl bg-[var(--dc-chip-strong)] text-[var(--dc-text)] hover:bg-[var(--dc-accent)] hover:text-white transition-colors"
        title="Download Track"
      >
        <Download className="w-4 h-4" />
      </motion.a>
    </motion.li>
  );
}

function Skeleton() {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[var(--dc-border)] bg-[rgba(0,0,0,0.2)] p-4 animate-pulse">
      <div className="flex-1 space-y-3">
        <div className="h-4 w-48 rounded bg-[var(--dc-chip-strong)]" />
        <div className="h-3 w-32 rounded bg-[var(--dc-chip)]" />
        <div className="h-4 w-24 rounded bg-[var(--dc-chip)] mt-2" />
      </div>
      <div className="h-10 w-10 rounded-xl bg-[var(--dc-chip-strong)]" />
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
    <div className="dc-glass-strong rounded-[2rem] p-6 lg:p-8 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--dc-accent)] opacity-5 blur-[100px] rounded-full pointer-events-none" />

      {/* Header */}
      <div className="relative flex items-start justify-between gap-4 z-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--dc-text)] flex items-center gap-3">
            <FileAudio className="w-6 h-6 text-[var(--dc-accent)]" />
            Library
          </h1>
          <p className="mt-2 text-sm text-[var(--dc-muted)] font-medium">Your processed, DJ-ready tracks</p>
        </div>
        <div className="flex items-center gap-3">
          {items.length > 0 && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={async () => {
                try {
                  toast.info("Generating Rekordbox XML...");
                  await api.exportRekordboxXml();
                  toast.success("XML downloaded! Import it into Rekordbox.");
                } catch {
                  toast.error("Failed to export XML");
                }
              }}
              className="flex items-center gap-2 rounded-xl bg-[var(--dc-accent-bg)] border border-[var(--dc-accent-border)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--dc-accent-text)] hover:bg-[var(--dc-accent)] hover:text-white transition-colors"
            >
              Export Rekordbox XML
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={loadLibrary}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-[var(--dc-chip)] border border-[var(--dc-border)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--dc-text)] hover:bg-[var(--dc-chip-strong)] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin text-[var(--dc-accent)]")} />
            Refresh
          </motion.button>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/40 border border-[var(--dc-border)]">
            <span className="flex h-2 w-2 rounded-full bg-[var(--dc-success-text)] animate-pulse" />
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--dc-success-text)]">
              {items.length} Ready
            </span>
          </div>
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
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="relative mt-8 flex flex-col gap-4 sm:flex-row sm:items-center z-10">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dc-muted)] group-focus-within:text-[var(--dc-accent)] transition-colors" />
            <input
              type="text"
              placeholder="Search by artist, title, or genre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-[var(--dc-border)] bg-[rgba(0,0,0,0.3)] pl-11 pr-4 py-3 text-sm text-[var(--dc-text)] placeholder-[var(--dc-muted2)] focus:border-[var(--dc-accent-light)] focus:bg-[rgba(0,0,0,0.5)] focus:shadow-[0_0_15px_var(--dc-accent-bg)] transition-all outline-none"
            />
          </div>
          <div className="flex items-center gap-3 bg-[var(--dc-chip)] p-1.5 rounded-2xl border border-[var(--dc-border)]">
            <span className="pl-3 text-xs font-bold tracking-wider uppercase text-[var(--dc-muted)]">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as "date" | "artist" | "title")}
              className="rounded-xl bg-[rgba(0,0,0,0.5)] px-4 py-2 text-xs font-bold text-[var(--dc-text)] border border-transparent focus:border-[var(--dc-accent)] outline-none cursor-pointer hover:bg-black transition-colors appearance-none"
            >
              <option value="date">Date Added</option>
              <option value="artist">Artist</option>
              <option value="title">Title</option>
            </select>
          </div>
        </motion.div>
      )}

      {/* Content */}
      <div className="relative mt-6 z-10">
        <motion.ul
          className="flex flex-col gap-3 pb-8"
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.05 } }
          }}
        >
          {loading ? (
            <>
              <Skeleton />
              <Skeleton />
              <Skeleton />
            </>
          ) : items.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-24 rounded-3xl border-2 border-dashed border-[var(--dc-border)] bg-[rgba(0,0,0,0.1)]"
            >
              <FileAudio className="h-16 w-16 text-[var(--dc-muted2)] mb-6 opacity-50" />
              <h3 className="text-xl font-bold tracking-tight text-[var(--dc-text)]">Vault Empty</h3>
              <p className="mt-2 text-sm text-[var(--dc-muted)]">
                Process tracks in the Queue to build your library.
              </p>
            </motion.div>
          ) : filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16"
            >
              <Search className="h-12 w-12 text-[var(--dc-muted2)] mb-4 opacity-50" />
              <p className="text-lg font-bold text-[var(--dc-text)]">No matches found</p>
              <p className="mt-1 text-sm text-[var(--dc-muted)]">
                No tracks match your search for <span className="text-[var(--dc-accent-light)] font-medium">"{search}"</span>
              </p>
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filtered.map((item) => <LibraryItemRow key={item.id} item={item} />)}
            </AnimatePresence>
          )}
        </motion.ul>
      </div>
    </div>
  );
}
