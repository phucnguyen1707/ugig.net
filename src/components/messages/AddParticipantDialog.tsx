"use client";

import { useState, useEffect, useRef } from "react";
import { UserPlus, Search, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import type { Profile } from "@/types";

type ParticipantProfile = Pick<Profile, "id" | "username" | "full_name" | "avatar_url">;

interface SearchUser {
  id: string;
  username: string;
  avatar_url: string | null;
}

interface AddParticipantDialogProps {
  conversationId: string;
  existingParticipantIds: string[];
  onParticipantAdded: (participant: ParticipantProfile) => void;
}

export function AddParticipantDialog({
  conversationId,
  existingParticipantIds,
  onParticipantAdded,
}: AddParticipantDialogProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(query)}&limit=8`
        );
        const data = await res.json();
        setResults(
          (data.users || []).filter(
            (u: SearchUser) => !existingParticipantIds.includes(u.id)
          )
        );
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, existingParticipantIds]);

  const handleAdd = async (u: SearchUser) => {
    setIsAdding(u.id);
    setError(null);
    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/participants`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: u.id }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to add participant");
        return;
      }
      onParticipantAdded(data.participant);
      setOpen(false);
      setQuery("");
      setResults([]);
    } finally {
      setIsAdding(null);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        title="Add participant"
      >
        <UserPlus className="h-4 w-4" />
      </Button>

      {open && (
        <div className="absolute right-0 top-10 w-72 bg-card border border-border rounded-lg shadow-xl z-50 p-3" style={{ backdropFilter: "none" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Add to conversation</span>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search by username..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            />
          </div>

          {error && <p className="text-xs text-destructive mt-2">{error}</p>}

          {isSearching && (
            <div className="flex justify-center py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isSearching && results.length > 0 && (
            <ul className="mt-2 space-y-1 max-h-52 overflow-y-auto">
              {results.map((u) => (
                <li key={u.id}>
                  <button
                    onClick={() => handleAdd(u)}
                    disabled={isAdding === u.id}
                    className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-muted transition-colors text-left disabled:opacity-50"
                  >
                    <Avatar className="h-7 w-7 flex-shrink-0">
                      {u.avatar_url ? (
                        <AvatarImage src={u.avatar_url} alt={u.username} />
                      ) : (
                        <AvatarFallback className="text-xs">
                          {u.username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <span className="text-sm truncate">{u.username}</span>
                    {isAdding === u.id && (
                      <Loader2 className="h-3 w-3 animate-spin ml-auto flex-shrink-0" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!isSearching && query.trim() && results.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">
              No users found
            </p>
          )}
        </div>
      )}
    </div>
  );
}
