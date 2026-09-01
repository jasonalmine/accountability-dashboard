process.env.PIPELINE_ID = "pipe1";
process.env.PIPELINE_BANDS = JSON.stringify([
  { name: "Registered", upTo: 0 }, { name: "Foundations", upTo: 39 },
  { name: "Core Build", upTo: 80 }, { name: "Automation", upTo: 97 },
  { name: "Certification Ready", upTo: null },
]);
process.env.PIPELINE_STAGES = JSON.stringify({
  "Registered": "s0", "Foundations": "s1", "Core Build": "s2",
  "Automation": "s3", "Certification Ready": "s4",
});
const { stageForCount, isMirroring } = await import("../src/lib/pipeline");

let fails = 0;
const check = (l: string, a: unknown, e: unknown) => {
  const ok = JSON.stringify(a) === JSON.stringify(e);
  if (!ok) fails++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${l}${ok ? "" : `  got ${JSON.stringify(a)}, want ${JSON.stringify(e)}`}`);
};

check("mirroring enabled when configured", isMirroring(), true);
check("no check-in -> entry stage", stageForCount(null)?.name, "Registered");
check("1 lesson -> Foundations", stageForCount(1)?.name, "Foundations");
check("39 (band edge) -> Foundations", stageForCount(39)?.name, "Foundations");
check("40 -> Core Build", stageForCount(40)?.name, "Core Build");
check("80 (band edge) -> Core Build", stageForCount(80)?.name, "Core Build");
check("81 -> Automation", stageForCount(81)?.name, "Automation");
check("97 (band edge) -> Automation", stageForCount(97)?.name, "Automation");
check("98 -> Certification Ready", stageForCount(98)?.name, "Certification Ready");
check("114 -> Certification Ready", stageForCount(114)?.name, "Certification Ready");
check("beyond the last band still resolves", stageForCount(999)?.name, "Certification Ready");
check("stage id comes back", stageForCount(50)?.id, "s2");

// every count 0-114 must land in exactly one stage
const seen = new Set<string>();
let gaps = 0;
for (let n = 0; n <= 114; n++) { const s = stageForCount(n); if (!s) gaps++; else seen.add(s.name); }
check("no count falls through", gaps, 0);
check("all four progress stages reachable", seen.size, 4);

console.log(`\n${fails === 0 ? "ALL PASS" : `${fails} FAILURE(S)`}`);
process.exit(fails ? 1 : 0);
