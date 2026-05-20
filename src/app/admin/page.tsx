import { SectionHead } from "@/components/ui/brand/SectionHead";
import { DashboardStats } from "@/components/admin/DashboardStats";
import { PostsByAoChart } from "@/components/admin/PostsByAoChart";
import { TopPaxChart } from "@/components/admin/TopPaxChart";
import { getDashboardStats } from "@/lib/stats/getDashboardStats";
import { nameToSlug } from "@/lib/stats/slugify";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const stats = await getDashboardStats();

  const aoHref = (slug: string) => `/admin/analytics/ao/${slug}`;
  const paxHref = (paxKey: string) => {
    const label = stats.topPax.find((p) => p.key === paxKey)?.label ?? paxKey;
    return `/admin/analytics/pax/${nameToSlug(label)}`;
  };

  return (
    <section className="max-w-[1320px] mx-auto px-7 py-16">
      <SectionHead
        eyebrow="§ Admin · Dashboard"
        h2="Region Ops."
        kicker={<>YTD region analytics. Click any metric to drill down.</>}
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
          <PostsByAoChart data={stats.byAo} href={aoHref} />
        </div>
        <div className="md:col-span-7">
          <TopPaxChart data={stats.topPax} href={paxHref} />
        </div>
      </div>
    </section>
  );
}
