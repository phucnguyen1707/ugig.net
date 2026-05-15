"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, ChevronRight, Check, X, Loader2, Clock, DollarSign, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "@/components/ui/MarkdownContent";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { AgentBadge } from "@/components/ui/AgentBadge";
import { formatRelativeTime } from "@/lib/utils";

interface Applicant {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  verified?: boolean | null;
  verification_type?: string | null;
  account_type?: string | null;
  agent_name?: string | null;
  agent_operator_url?: string | null;
}

export interface PendingApplication {
  id: string;
  cover_letter: string | null;
  created_at: string;
  proposed_rate: number | null;
  proposed_timeline: string | null;
  applicant: Applicant | Applicant[] | null;
}

interface PendingApplicantsDropdownProps {
  gigId: string;
  applications: PendingApplication[];
}

export function PendingApplicantsDropdown({
  gigId,
  applications,
}: PendingApplicantsDropdownProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const count = applications.length;

  const updateStatus = async (applicationId: string, status: "accepted" | "rejected") => {
    setLoadingId(`${applicationId}:${status}`);
    setError(null);

    try {
      const res = await fetch(`/api/applications/${applicationId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update status");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setLoadingId(null);
    }
  };

  if (count === 0) {
    return null;
  }

  return (
    <div className="mt-4 border border-yellow-500/30 bg-yellow-500/5 rounded-lg">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-yellow-500/10 rounded-lg transition-colors"
        aria-expanded={expanded}
        data-testid={`expand-pending-${gigId}`}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-yellow-700 dark:text-yellow-400">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          {count} pending {count === 1 ? "applicant" : "applicants"}
        </span>
        <span className="text-xs text-muted-foreground">
          {expanded ? "Hide" : "Review"}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-2 space-y-3 border-t border-yellow-500/20">
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {applications.map((app) => {
            const applicant = Array.isArray(app.applicant)
              ? app.applicant[0]
              : app.applicant;

            const acceptKey = `${app.id}:accepted`;
            const rejectKey = `${app.id}:rejected`;

            return (
              <div
                key={app.id}
                className="p-4 bg-card rounded-lg border border-border"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <Link
                    href={`/u/${applicant?.username}`}
                    className="flex items-center gap-3 hover:opacity-80 min-w-0"
                  >
                    <Image
                      src={applicant?.avatar_url || "/default-avatar.svg"}
                      alt={applicant?.full_name || applicant?.username || "Applicant"}
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-full object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-medium flex items-center gap-1.5 text-sm">
                        <span className="truncate">
                          {applicant?.full_name || applicant?.username}
                        </span>
                        {applicant?.verified && (
                          <VerifiedBadge
                            verificationType={applicant.verification_type as never}
                            size="sm"
                          />
                        )}
                        {applicant?.account_type === "agent" && (
                          <AgentBadge
                            agentName={applicant.agent_name}
                            operatorUrl={applicant.agent_operator_url}
                            size="sm"
                          />
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        @{applicant?.username}
                        <ExternalLink className="h-3 w-3" />
                      </p>
                    </div>
                  </Link>

                  <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                    <Clock className="h-3 w-3" />
                    {formatRelativeTime(app.created_at)}
                  </span>
                </div>

                {(app.proposed_rate || app.proposed_timeline) && (
                  <div className="flex flex-wrap items-center gap-3 mb-3 text-xs">
                    {app.proposed_rate && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <DollarSign className="h-3 w-3" />
                        ${app.proposed_rate} proposed
                      </span>
                    )}
                    {app.proposed_timeline && (
                      <span className="text-muted-foreground">
                        Timeline: {app.proposed_timeline}
                      </span>
                    )}
                  </div>
                )}

                <div className="mb-3">
                  <p className="text-xs font-medium mb-1.5 text-muted-foreground">Cover Letter</p>
                  {app.cover_letter ? (
                    <MarkdownContent content={app.cover_letter} className="text-sm" />
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No cover letter provided.</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => updateStatus(app.id, "accepted")}
                    disabled={loadingId !== null}
                    data-testid={`approve-${app.id}`}
                  >
                    {loadingId === acceptKey ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-1.5" />
                    )}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => updateStatus(app.id, "rejected")}
                    disabled={loadingId !== null}
                    data-testid={`reject-${app.id}`}
                  >
                    {loadingId === rejectKey ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                      <X className="h-4 w-4 mr-1.5" />
                    )}
                    Reject
                  </Button>
                  <Link
                    href={`/gigs/${gigId}/applications`}
                    className="text-xs text-muted-foreground hover:text-foreground ml-auto underline"
                  >
                    Full details
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
