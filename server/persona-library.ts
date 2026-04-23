// Curated persona packs seeded into persona_templates on startup.
// Users browse, preview, and one-click-apply to a project to upsert agents.

import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { getDb } from "./db";
import { personaTemplates, type PersonaTemplate, type InsertPersonaTemplate, agents } from "../drizzle/schema";

export type PersonaScope = "narrative" | "technical" | "finance";
export type PersonaPlatform = "twitter" | "reddit";

export interface SeedPersona {
  name: string;
  persona: string;
  ideology?: string;
  platform?: PersonaPlatform;
  followers?: number;
}

interface SeedPack {
  scope: PersonaScope;
  name: string;
  description: string;
  personas: SeedPersona[];
}

// ─── NARRATIVE PACKS (default workflow) ──────────────────────────────────────
const NARRATIVE_PACKS: SeedPack[] = [
  {
    scope: "narrative",
    name: "Public discourse — balanced",
    description: "Mainstream press, partisan voices, civil-society NGOs and average citizens. Good for broad sentiment simulation.",
    personas: [
      { name: "Maya the Journalist", persona: "Mid-career reporter at a national daily; values accuracy over speed; sceptical of both spin and conspiracy.", ideology: "centrist-pragmatic", platform: "twitter", followers: 38000 },
      { name: "Ravi the Influencer", persona: "Right-leaning podcaster with millions of fans; emotionally driven, frames issues as us-vs-them.", ideology: "populist-right", platform: "twitter", followers: 1200000 },
      { name: "Priya the Activist", persona: "Climate & social-justice campaigner; outraged easily; quick to mobilise online crowds.", ideology: "progressive-left", platform: "twitter", followers: 86000 },
      { name: "Ahmed the Analyst", persona: "Think-tank researcher; cool-headed, data-first, writes policy briefs.", ideology: "technocratic-centrist", platform: "twitter", followers: 12000 },
      { name: "Sam the Citizen", persona: "Suburban parent on r/news; mostly lurks, occasionally posts strong opinion when something hits home.", ideology: "moderate-undecided", platform: "reddit", followers: 240 },
      { name: "Lin the Skeptic", persona: "Retired engineer who fact-checks everything; loves long-form analysis; distrusts official narratives.", ideology: "libertarian-skeptic", platform: "reddit", followers: 3100 },
    ],
  },
  {
    scope: "narrative",
    name: "Crisis-comms war-room",
    description: "Stakeholders to model when stress-testing a corporate announcement: press, regulators, customers, employees, short-sellers.",
    personas: [
      { name: "Wall Street Journal beat reporter", persona: "Seasoned business reporter who pattern-matches today's news against past corporate scandals.", ideology: "skeptical-establishment", platform: "twitter", followers: 95000 },
      { name: "Activist short-seller", persona: "Publishes detailed bear-thesis reports; weaponises any inconsistency in messaging.", ideology: "adversarial-financial", platform: "twitter", followers: 220000 },
      { name: "Disgruntled former employee", persona: "Posts on Glassdoor and LinkedIn; first to claim 'I told you so' when problems surface.", ideology: "insider-grudge", platform: "reddit", followers: 1200 },
      { name: "Loyal customer advocate", persona: "Long-time user; defends the brand reflexively but loses patience with corporate-speak.", ideology: "brand-defender", platform: "twitter", followers: 8400 },
      { name: "Sector regulator", persona: "Risk-averse civil servant; reads every press release for signals that an investigation is warranted.", ideology: "regulatory-cautious", platform: "twitter", followers: 4200 },
      { name: "Tier-1 institutional analyst", persona: "Sell-side equity analyst at a major bank; immediately models impact on EPS and price target.", ideology: "fundamentals-driven", platform: "twitter", followers: 28000 },
    ],
  },
];

// ─── TECHNICAL PACKS (engineering / formulation) ─────────────────────────────
const TECHNICAL_PACKS: SeedPack[] = [
  {
    scope: "technical",
    name: "RFID / antenna design review",
    description: "Multi-disciplinary review for RFID tags, readers, and deployment. Use for impedance matching, range, BOM, regulatory.",
    personas: [
      { name: "RF antenna physicist", persona: "PhD in electromagnetics; thinks in S-parameters, impedance matching, near-field vs far-field; cites Balanis chapter and verse.", ideology: "rigour-first", followers: 0 },
      { name: "RFID system architect", persona: "Spent 15 years on UHF passive tag platforms; obsesses over chip wake-up sensitivity, anti-collision protocols, EPC Gen2v2.", ideology: "system-integration", followers: 0 },
      { name: "Label-converter manufacturing engineer", persona: "Runs the production line; flags any design that won't survive web-press lamination, die-cut, or roll-to-roll handling.", ideology: "yield-and-cost", followers: 0 },
      { name: "Warehouse deployment lead", persona: "Manages 100+ readers across a DC; cares about read rates on metal, liquids, dense pallets, RF noise from forklifts.", ideology: "field-pragmatist", followers: 0 },
      { name: "FCC / ETSI compliance reviewer", persona: "Tests Part 15.247 emissions limits; stops the project cold if spurious emissions or duty-cycle look wrong.", ideology: "regulatory-strict", followers: 0 },
      { name: "Cost / BOM optimiser", persona: "Procurement-engineering hybrid; will swap a $0.02 chip difference if volumes justify; tracks substrate, adhesive, inlay yields.", ideology: "cost-relentless", followers: 0 },
    ],
  },
  {
    scope: "technical",
    name: "Chemical formulation review",
    description: "Wax, fragrance, ink, polymer, coating, and consumer-goods formulation reviews. Multi-disciplinary trade-off discussion.",
    personas: [
      { name: "Senior formulation chemist", persona: "20 years in consumer products; thinks in HLB, solubility parameters, eutectic points, rheology curves.", ideology: "chemistry-first", followers: 0 },
      { name: "Fragrance / flavour evaluator", persona: "Trained perfumer or flavourist; smells everything; flags olfactory mismatches and allergen IFRA limits.", ideology: "sensory-expert", followers: 0 },
      { name: "Process / scale-up engineer", persona: "Translates lab beaker to 5,000-litre kettle; warns of mixing time, heat-transfer, hold-time degradation issues.", ideology: "scale-up-realist", followers: 0 },
      { name: "QA / stability technician", persona: "Runs accelerated aging, freeze/thaw, photostability; knows what fails after 12 months on a hot warehouse shelf.", ideology: "stability-paranoid", followers: 0 },
      { name: "Regulatory / safety reviewer", persona: "Prop 65, REACH, FDA, IFRA, SDS expert; happy to kill a beautiful formula over one banned solvent.", ideology: "compliance-strict", followers: 0 },
      { name: "Cost-of-goods optimiser", persona: "Knows the price per kg of every raw material; pushes back on luxury ingredients in mass-market SKUs.", ideology: "margin-focused", followers: 0 },
    ],
  },
];

// ─── FINANCE PACKS (catalyst & narrative tracking) ───────────────────────────
const FINANCE_PACKS: SeedPack[] = [
  {
    scope: "finance",
    name: "Equity catalyst — discretionary L/S",
    description: "Round-table for catalyst-driven equity decisions: earnings, M&A, FDA, regulatory. Designed for narrative-as-overlay, not price prediction.",
    personas: [
      { name: "Sell-side analyst", persona: "Top-ranked II analyst; thinks in price targets, EPS revisions, sum-of-the-parts; cautious about being too far from consensus.", ideology: "consensus-anchored", platform: "twitter", followers: 18000 },
      { name: "Hedge-fund PM (long bias)", persona: "Concentrated long book; obsessive about quality of management commentary; long-term thesis framing.", ideology: "fundamentals-quality", platform: "twitter", followers: 6500 },
      { name: "Activist short-seller", persona: "Publishes bear-thesis reports; pattern-matches against historical fraud and accounting issues; weaponises tone changes.", ideology: "adversarial-bear", platform: "twitter", followers: 240000 },
      { name: "Retail momentum trader (WSB)", persona: "r/WallStreetBets regular; trades narrative + flow; emotional, herd-prone, options-heavy.", ideology: "momentum-meme", platform: "reddit", followers: 4500 },
      { name: "Risk officer / CRO", persona: "Watches for tail-risk; cares about correlations, liquidity, position sizing; first to call for cuts.", ideology: "risk-paranoid", platform: "twitter", followers: 2200 },
      { name: "Macro strategist", persona: "Top-down view; reframes single-stock catalyst against rates, FX, sector rotation; rarely tactical.", ideology: "macro-overlay", platform: "twitter", followers: 22000 },
      { name: "Specialist sector analyst", persona: "Deep domain expert (e.g. semis, biotech); knows the company's customers, suppliers, channel checks.", ideology: "domain-specialist", platform: "twitter", followers: 14000 },
    ],
  },
  {
    scope: "finance",
    name: "Commodity / macro narrative",
    description: "Oil, gas, metals, agri commodities. Models how supply/demand narratives shift via OPEC, weather, geopolitics, inventory data.",
    personas: [
      { name: "Commodity trading desk head", persona: "Physical and paper trader; thinks in barrels, contango, spreads, storage economics.", ideology: "fundamentals-flow", platform: "twitter", followers: 9000 },
      { name: "Geopolitical analyst", persona: "Risk-consultancy senior; tracks sanctions, conflicts, shipping chokepoints; reframes prices through political lens.", ideology: "geopolitical-driver", platform: "twitter", followers: 31000 },
      { name: "Energy-transition strategist", persona: "Long-horizon view on demand destruction from EVs, renewables, efficiency; sceptical of cyclical narratives.", ideology: "secular-transition", platform: "twitter", followers: 18000 },
      { name: "Weather / supply analyst", persona: "Tracks crop weeklies, hurricane paths, El Niño; quantitative, model-driven.", ideology: "data-driven-supply", platform: "twitter", followers: 4500 },
      { name: "Central-bank / FX strategist", persona: "Frames commodity moves through DXY, real rates, EM demand; rarely a single-commodity specialist.", ideology: "macro-financial", platform: "twitter", followers: 15000 },
    ],
  },
];

const ALL_SEEDS: SeedPack[] = [...NARRATIVE_PACKS, ...TECHNICAL_PACKS, ...FINANCE_PACKS];

// Run-once-per-process flag so we don't re-seed on every request.
let _seeded = false;

export async function seedPersonaTemplates(): Promise<void> {
  if (_seeded) return;
  const db = await getDb();
  if (!db) return;
  for (const pack of ALL_SEEDS) {
    const existing = await db
      .select()
      .from(personaTemplates)
      .where(and(eq(personaTemplates.scope, pack.scope), eq(personaTemplates.name, pack.name), eq(personaTemplates.isSystem, true)))
      .limit(1);
    if (existing.length > 0) continue;
    const insert: InsertPersonaTemplate = {
      userId: null,
      scope: pack.scope,
      name: pack.name,
      description: pack.description,
      personas: pack.personas,
      isSystem: true,
    };
    await db.insert(personaTemplates).values(insert);
  }
  _seeded = true;
}

export async function listPersonaTemplates(opts: { scope?: PersonaScope; userId?: number }): Promise<PersonaTemplate[]> {
  await seedPersonaTemplates();
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (opts.scope) conditions.push(eq(personaTemplates.scope, opts.scope));
  // Show system-seeded packs to everyone, plus the requesting user's own packs.
  if (opts.userId !== undefined) {
    conditions.push(or(eq(personaTemplates.isSystem, true), eq(personaTemplates.userId, opts.userId))!);
  }
  const query = conditions.length > 0 ? db.select().from(personaTemplates).where(and(...conditions)) : db.select().from(personaTemplates);
  return query.orderBy(desc(personaTemplates.isSystem), desc(personaTemplates.createdAt));
}

export async function getPersonaTemplate(id: number): Promise<PersonaTemplate | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(personaTemplates).where(eq(personaTemplates.id, id)).limit(1);
  return row ?? null;
}

export async function createPersonaTemplate(data: InsertPersonaTemplate): Promise<PersonaTemplate | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(personaTemplates).values(data);
  const insertedId = (result as unknown as { insertId: number }).insertId;
  const [created] = await db.select().from(personaTemplates).where(eq(personaTemplates.id, insertedId)).limit(1);
  return created ?? null;
}

export async function deletePersonaTemplate(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // Don't let users delete system-seeded packs.
  await db.delete(personaTemplates).where(and(eq(personaTemplates.id, id), eq(personaTemplates.userId, userId), eq(personaTemplates.isSystem, false)));
}

// Apply a template to a project: insert agents (skipping any with the same name).
export async function applyTemplateToProject(args: { templateId: number; projectId: number }): Promise<{ applied: number; skipped: number }> {
  const db = await getDb();
  if (!db) return { applied: 0, skipped: 0 };
  const tpl = await getPersonaTemplate(args.templateId);
  if (!tpl) return { applied: 0, skipped: 0 };

  const existing = await db.select().from(agents).where(eq(agents.projectId, args.projectId));
  const existingNames = new Set(existing.map((a) => a.name));

  let applied = 0;
  let skipped = 0;
  for (const p of tpl.personas) {
    if (existingNames.has(p.name)) { skipped += 1; continue; }
    const agentId = `${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32)}-${Date.now().toString(36).slice(-4)}`;
    await db.insert(agents).values({
      projectId: args.projectId,
      agentId,
      name: p.name,
      persona: p.persona,
      platform: p.platform ?? "twitter",
      followers: p.followers ?? 0,
      following: 0,
      ideology: p.ideology ?? null,
    });
    applied += 1;
  }
  return { applied, skipped };
}
