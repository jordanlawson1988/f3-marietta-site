import { SectionHead } from "@/components/ui/brand/SectionHead";
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
        kicker={<>YTD region analytics.</>}
        align="left"
      />

      <DashboardStats
        totalPosts={stats.totalPosts}
        uniquePax={stats.uniquePax}
        newFngs={stats.newFngs}
        aoCount={stats.byAo.length}
      />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-5">
          <PostsByAoChart data={stats.byAo} />
        </div>
        <div className="md:col-span-7">
          <TopPaxChart data={stats.topPax} />
        </div>
      </div>
    </section>
  );
}
