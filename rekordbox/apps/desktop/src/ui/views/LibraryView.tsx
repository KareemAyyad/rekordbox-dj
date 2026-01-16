import { useEffect, useMemo, useState } from "react";
import { getBackend } from "../../state/backend";
import { useToast } from "../components/Toast";
import { Badge, Button, Card, Select, Skeleton, TextInput } from "../components/ui";

type LibraryItem = {
  id: string;
  path: string;
  artist: string;
  title: string;
  genre: string;
  downloadedAt: string;
};

type SortOption = "date" | "artist" | "title";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "date", label: "Date Added" },
  { value: "artist", label: "Artist" },
  { value: "title", label: "Title" },
];

/* ─────────────────────────────────────────────────────────────────────────────
   Skeleton Loader
   ───────────────────────────────────────────────────────────────────────────── */
function LibraryItemSkeleton(): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[color:var(--dc-border)] bg-[var(--dc-card2)] px-5 py-4">
      <div className="min-w-0 flex-1 space-y-3">
        <Skeleton className="h-4 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-lg" />
          <Skeleton className="h-5 w-28 rounded-lg" />
        </div>
        <Skeleton className="h-3 w-64" />
      </div>
      <div className="flex shrink-0 gap-2">
        <Skeleton className="h-8 w-16 rounded-xl" />
        <Skeleton className="h-8 w-14 rounded-xl" />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Empty State
   ───────────────────────────────────────────────────────────────────────────── */
function EmptyState(): JSX.Element {
  return (
    <div className="dc-animate-fadeIn rounded-2xl border border-dashed border-[color:var(--dc-border)] bg-[var(--dc-card2)] px-6 py-16 text-center">
      {/* Vinyl/Music Icon */}
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--dc-chip)]">
        <svg
          className="h-8 w-8 text-[var(--dc-muted)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z"
          />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-[var(--dc-text)]">Your library is empty</h3>
      <p className="mx-auto mt-2 max-w-xs text-sm text-[var(--dc-muted)]">
        Start downloading tracks from the Queue tab to build your collection.
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Search Empty State
   ───────────────────────────────────────────────────────────────────────────── */
function NoResultsState({ query }: { query: string }): JSX.Element {
  return (
    <div className="dc-animate-fadeIn rounded-2xl border border-[color:var(--dc-border)] bg-[var(--dc-card2)] px-6 py-12 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--dc-chip)]">
        <svg
          className="h-6 w-6 text-[var(--dc-muted)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-[var(--dc-text)]">No matches found</h3>
      <p className="mt-1 text-sm text-[var(--dc-muted)]">
        No tracks match "{query}". Try a different search.
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Library Item Row
   ───────────────────────────────────────────────────────────────────────────── */
function LibraryItemRow({
  item,
  onReveal,
  onOpen,
}: {
  item: LibraryItem;
  onReveal: () => void;
  onOpen: () => void;
}): JSX.Element {
  const formattedDate = new Date(item.downloadedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="dc-animate-fadeIn group flex items-center gap-4 rounded-2xl border border-[color:var(--dc-border)] bg-[var(--dc-card2)] px-5 py-4 transition-all duration-200 hover:border-[color:var(--dc-border-strong)] hover:bg-[var(--dc-card2-hover)]">
      {/* Track Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-semibold text-[var(--dc-text)]">{item.title}</span>
        </div>
        <div className="mt-0.5 truncate text-sm text-[var(--dc-muted)]">{item.artist}</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge className="text-[10px] font-medium">{item.genre}</Badge>
          <span className="text-[11px] text-[var(--dc-muted2)]">{formattedDate}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2 opacity-70 transition-opacity group-hover:opacity-100">
        <Button size="sm" variant="ghost" onClick={onReveal} title="Reveal in Finder">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
        </Button>
        <Button size="sm" variant="primary" onClick={onOpen}>
          Play
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main View
   ───────────────────────────────────────────────────────────────────────────── */
export function LibraryView(props: { settings: { inboxDir: string } }): JSX.Element {
  const backend = getBackend();
  const { addToast } = useToast();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Sort state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("date");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await backend.library.list({ inboxDir: props.settings.inboxDir });
        if (cancelled) return;
        setItems(res);
      } catch (e: unknown) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
        addToast("error", "Failed to load library");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [props.settings.inboxDir, backend.library]);

  // Filter and sort items
  const filteredItems = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    // Filter
    let result = items;
    if (query) {
      result = items.filter(
        (it) =>
          it.artist.toLowerCase().includes(query) ||
          it.title.toLowerCase().includes(query)
      );
    }

    // Sort
    return [...result].sort((a, b) => {
      switch (sortBy) {
        case "artist":
          return a.artist.localeCompare(b.artist);
        case "title":
          return a.title.localeCompare(b.title);
        case "date":
        default:
          return new Date(b.downloadedAt).getTime() - new Date(a.downloadedAt).getTime();
      }
    });
  }, [items, searchQuery, sortBy]);

  const hasItems = items.length > 0;
  const hasResults = filteredItems.length > 0;

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--dc-text)]">Library</h1>
          <p className="mt-1 text-sm text-[var(--dc-muted)]">
            Your downloaded tracks from inbox sidecars
          </p>
        </div>
        <Badge className="rounded-xl px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide">
          {items.length} {items.length === 1 ? "Track" : "Tracks"}
        </Badge>
      </div>

      {/* Error State */}
      {error && (
        <div className="dc-animate-fadeIn mt-4 rounded-2xl border border-[color:var(--dc-danger-border)] bg-[var(--dc-danger-bg)] p-4">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-[var(--dc-danger-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-[var(--dc-danger-text)]">Failed to load library</p>
              <p className="mt-0.5 text-sm text-[var(--dc-danger-text)] opacity-80">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Search & Sort Controls */}
      {!loading && hasItems && (
        <div className="dc-animate-fadeIn mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search Input */}
          <div className="relative flex-1">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dc-muted)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <TextInput
              type="text"
              placeholder="Search by artist or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--dc-muted)]">Sort by</span>
            <Select
              value={sortBy}
              onChange={(val) => setSortBy(val as SortOption)}
              options={SORT_OPTIONS}
              className="w-32"
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="mt-6 space-y-3">
        {loading ? (
          // Skeleton Loading State
          <>
            <LibraryItemSkeleton />
            <LibraryItemSkeleton />
            <LibraryItemSkeleton />
          </>
        ) : !hasItems ? (
          // Empty State
          <EmptyState />
        ) : !hasResults ? (
          // No Search Results
          <NoResultsState query={searchQuery} />
        ) : (
          // Items List
          filteredItems.map((it) => (
            <LibraryItemRow
              key={it.id}
              item={it}
              onReveal={async () => {
                const ok = await backend.shell.reveal(it.path);
                if (!ok) addToast("error", "Could not reveal file in Finder");
              }}
              onOpen={async () => {
                const ok = await backend.shell.open(it.path);
                if (!ok) addToast("error", "Could not open file");
              }}
            />
          ))
        )}
      </div>
    </Card>
  );
}
