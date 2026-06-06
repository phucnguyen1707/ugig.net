"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCheck } from "lucide-react";

export function ApproveAllButton({ gigId, count }: { gigId: string; count: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (count === 0) return null;

  const handleApproveAll = async () => {
    if (!confirm(`Approve all ${count} pending application${count === 1 ? "" : "s"} for this gig?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/gigs/${gigId}/applications/approve-all`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setDone(true);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to approve all");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleApproveAll}
      disabled={loading || done}
      className="gap-1.5 text-green-600 border-green-600/40 hover:bg-green-500/10 hover:text-green-600"
    >
      <CheckCheck className="h-3.5 w-3.5" />
      {loading ? "Approving…" : done ? "All approved" : `Approve all ${count}`}
    </Button>
  );
}
