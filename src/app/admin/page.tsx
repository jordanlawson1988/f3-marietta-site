import Link from "next/link";
import { SectionHead } from "@/components/ui/brand/SectionHead";
import { ChamferButton } from "@/components/ui/brand/ChamferButton";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { DashboardStats } from "@/components/admin/DashboardStats";
import { PostsByAoChart } from "@/components/admin/PostsByAoChart";
import { TopPaxChart } from "@/components/admin/TopPaxChart";
import { getDashboardStats } from "@/lib/stats/getDashboardStats";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const stats = await getDashboardStats();

  return (
    <section className="max-w-[1320px] mx-auto px-7 py-16">
      <SectionHead
        eyebrow="§ Admin · Dashboard"
        h2="Region Ops."
        kicker={<>YTD analytics + management.</>}
        align="left"
      />

      <DashboardStats
        totalPosts={stats.totalPosts}
        uniquePax={stats.uniquePax}
        newFngs={stats.newFngs}
        aoCount={stats.byAo.length}
      />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-14">
        <div className="md:col-span-5">
          <PostsByAoChart data={stats.byAo} />
        </div>
        <div className="md:col-span-7">
          <TopPaxChart data={stats.topPax} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-14">
        {[
          { label: "Active AOs", href: "/admin/workouts" },
          { label: "Regions", href: "/admin/regions" },
          { label: "Drafts", href: "/admin/drafts" },
          { label: "Newsletter", href: "/admin/newsletter" },
        ].map((tile) => (
          <Link key={tile.href} href={tile.href}>
            <ClipFrame className="group hover:border-ink transition-colors">
              <MonoTag>// {tile.label}</MonoTag>
              <div className="mt-4 font-display font-bold uppercase text-[32px] tracking-[-.01em]">
                Manage →
              </div>
            </ClipFrame>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <ChamferButton href="/admin/workouts" variant="ink" size="md">
          New Workout
        </ChamferButton>
        <ChamferButton href="/admin/drafts" variant="ink" size="md">
          New Draft
        </ChamferButton>
      </div>
    </section>
  );
}
