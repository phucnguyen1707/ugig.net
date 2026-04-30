import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RepoImportForm } from "@/components/skills/RepoImportForm";
import { ChevronLeft } from "lucide-react";

export const metadata = {
  title: "Import Skills from Repo | ugig.net",
  description: "Bulk import a GitHub repository of skills",
};

export default async function ImportSkillsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/dashboard/skills/import");
  }

  return (
    <div>
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/dashboard/skills"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            My Skills
          </Link>
          <RepoImportForm />
        </div>
      </main>
    </div>
  );
}
