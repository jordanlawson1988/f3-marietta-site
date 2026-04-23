import { getImpactStats } from "../src/lib/stats/getImpactStats";

(async () => {
  const stats = await getImpactStats();
  console.log("Impact stats:", stats);
  for (const [k, v] of Object.entries(stats)) {
    if (!Number.isFinite(v) || v < 0) {
      console.error(`FAIL: ${k} = ${v} is not a non-negative finite number`);
      process.exit(1);
    }
  }
  console.log("PASS: all stats are non-negative finite numbers");
  process.exit(0);
})();
