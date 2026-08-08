# TechScope Health Score Methodology — v1.0 (MVP)

> **Relationship to the previous draft:** The document this supersedes (internally labelled "v2.0") was a target architecture, not a build plan — archetype classification, cohort normalization, Bus Factor, and a Libraries.io-backed dependents metric are all sound *ideas*, but none of them can be built first. This document is the actual **v1.0**: the version that ships, gets validated against real data, and earns the right to grow into that more sophisticated design. Everything removed here is preserved in Section 12 as the explicit roadmap, not discarded.

Every score TechScope returns is tagged `"methodology_version": "1.0"`, so a future score change is never ambiguous between "the project changed" and "we changed how we measure."

---

## 1. Purpose

TechScope produces a deterministic, 0–100 **Health Score** for open-source packages, built from objective ecosystem signals (commit activity, release behaviour, issue handling, contributor spread, adoption, documentation) rather than subjective reputation or hype.

**Role of AI in the system:** an LLM is used **only** to translate an already-computed score and its metric breakdown into a plain-English explanation for the user. The AI receives the final score and per-metric numbers as fixed input *after* they are written to storage; it has no code path back into the scoring pipeline and cannot see raw API data before normalization happens. Score computation and score explanation are two physically separate pipeline stages — this is an architectural guarantee, not a prompting instruction. See §11.4.

---

## 2. Scope

**In scope for v1.0:**
- Registries: **npm** and **PyPI**
- Source hosting: **GitHub** only
- ~50–100 packages, hand-curated (this same set doubles as the validation benchmark — see §10)

**Explicitly out of scope for v1.0** (not a gap, a decision): any registry other than npm/PyPI, any source host other than GitHub, and any third-party data broker (Libraries.io, npms.io, etc.). If a package can't be resolved to a GitHub repo, it returns:

```json
{"score": null, "reason": "unsupported_or_unresolved"}
```

---

## 3. Selected Metrics

Down from 7 metrics to **6**, with one dropped outright (Ecosystem Dependents Ratio — see §12) and the rest simplified. Every metric below is required to pass three tests before it's allowed in the model:

1. **Why is this metric included?** — what does it actually indicate about health?
2. **Can I reliably collect it?** — from GitHub REST, npm registry, or PyPI/pypistats, with no auxiliary subsystem?
3. **Can I defend it in a viva or interview?** — is the definition simple enough to state in one sentence, and are its weaknesses known and disclosed?

| Metric | Replaces | Data Source | Weight |
|---|---|---|---|
| Commit Cadence | (same, simplified) | GitHub REST | 20% |
| Release Frequency | Release Cadence & Variance | GitHub REST | 15% |
| Issue Resolution Health | Issue Resolution Rate | GitHub REST | 20% |
| Contributor Concentration | Bus Factor | GitHub REST | 15% |
| Download Momentum | Download Velocity & Momentum | npm API / pypistats.org | 20% |
| Documentation Presence | Documentation Depth | GitHub REST | 10% |

---

## 4. Data Sources

One deliberate engineering win here: **Commit Cadence and Contributor Concentration are both derived from a single API call.**

| Source | Endpoint | Auth | Used For |
|---|---|---|---|
| GitHub REST | `/repos/{owner}/{repo}/stats/contributors` | Token | Commit Cadence, Contributor Concentration |
| GitHub REST | `/repos/{owner}/{repo}/releases` | Token | Release Frequency |
| GitHub REST | `/repos/{owner}/{repo}/issues?state=all&since=...` | Token | Issue Resolution Health |
| GitHub REST | `/repos/{owner}/{repo}/readme`, `/repos/{owner}/{repo}` (homepage field), `/repos/{owner}/{repo}/contents/` | Token | Documentation Presence |
| npm Registry | `api.npmjs.org/downloads/point/{period}/{package}` | None | Download Momentum (npm) |
| PyPI | `pypistats.org/api/packages/{package}/recent` | None | Download Momentum (PyPI) |

**No GraphQL in v1.** GraphQL batching only earns its complexity at request volumes this project won't reach. At ~100 packages × ~4 REST calls each, that's under 500 calls against a 5,000/hr authenticated budget — REST-only comfortably fits, and proving that with arithmetic is a better interview answer than pre-optimizing for a scale problem you don't have.

**No BigQuery.** `pypistats.org` mirrors the same underlying PyPI download data as a free, public, unauthenticated REST API — functionally equivalent for v1 purposes, with zero GCP setup or billing account required. This was cut for *infrastructure friction*, independent of the "remove advanced statistics" directive — worth keeping those two justifications separate when you write this up.

**No Libraries.io.** This is what killed Ecosystem Dependents Ratio outright rather than simplifying it — see §12.

---

## 5. Metric Definitions

### 5.1 Commit Cadence
**Definition:** Sum of weekly commit counts across the trailing 52 weeks, from `stats/contributors`, excluding any author whose login matches the `[bot]` suffix convention or a short maintained allowlist (`dependabot`, `renovate`, `github-actions`).
**Why:** Continuous human development activity is the most direct maintenance signal available.
**Can I collect it:** Yes — single endpoint, already returns per-author weekly breakdowns.
**Can I defend it:** Yes — bot filtering is a one-line string match, not a subsystem. The known limitation (a maintainer could rename a bot account to dodge the suffix) is disclosed, not hidden.

### 5.2 Release Frequency
**Definition:** Count of releases in the trailing 12 months where `prerelease: false` and `draft: false`.
**Why:** Regular releases indicate an active, shippable project.
**Can I collect it:** Yes — both fields are booleans directly on the `/releases` response, no extra parsing.
**Can I defend it:** Yes. **Cadence *variance* (coefficient of variation) is deliberately dropped for v1** — not because the maths is hard (it's `stdev/mean`), but because most benchmark-set packages won't have 12+ stable release intervals for the number to mean anything yet. Reintroducing it in v2 once real interval data exists is the honest sequencing (§12).

### 5.3 Issue Resolution Health
**Definition:** Over the trailing 180 days — resolution rate (closed / opened) and median days-to-close, computed from `created_at`/`closed_at` on the `/issues` endpoint, with pull requests excluded (the issues endpoint returns both; filter on the presence of a `pull_request` key).
**Why:** Maintainer responsiveness is one of the strongest predictors of whether contributors stick around.
**Can I collect it:** Yes, single paginated REST call.
**Can I defend it:** Yes, with a disclosed weakness: v1 does **not** distinguish human closures from stale-bot closures (that requires per-issue event/label inspection, a real jump in call volume). This is flagged as a known limitation, not silently ignored — see §12 for the v2 fix.

### 5.4 Contributor Concentration
**Definition:** `(commits by the single most active contributor) / (total human commits)`, trailing 12 months — reusing the data already pulled for §5.1. Lower is healthier.
**Why:** A direct, honest proxy for "how much does this project depend on one person," without pretending to compute the smallest-N-for-50% set that full Bus Factor requires.
**Can I collect it:** Yes — free, from data already fetched.
**Can I defend it:** Yes, and this is a good viva answer in itself: *"I chose a single ratio over the standard Bus Factor definition because Bus Factor requires an iterative ranking-and-accumulation step for marginal extra signal at this scale, and a single top-contributor ratio is transparent enough to sanity-check by eye against the GitHub contributors graph."* Same disclosed weakness as the original: penalizes small, excellent, single-expert utility packages. Not mitigated by archetype weighting in v1 — mitigated by disclosure and by the AI explanation layer surfacing it in context.

### 5.5 Download Momentum
**Definition:** Current 30-day download count, plus growth = `log(1 + current_30d) − log(1 + prior_30d)`.
**Why:** Combines adoption scale with trend direction.
**Can I collect it:** Yes — npm's point-in-time endpoint needs no auth; PyPI via pypistats.org, same.
**Can I defend it:** Yes. The log transform is one line of arithmetic, not "advanced statistics" — its job is to stop a package going from 3→30 downloads from outscoring an established package's steady growth. Known weakness, disclosed and *not* mitigated in v1: npm counts include CI/mirror traffic with no installer-type filter available. Flagged as `lower_confidence` in the response rather than silently trusted.

### 5.6 Documentation Presence
**Definition:** A 3-point structural checklist, normalized to 0–100:
1. README exists and is ≥1.5KB (`/readme` endpoint, size field — floor filter only, no credit for extra length)
2. Repo `homepage` field is populated **or** a `/docs` folder exists at repo root (both come from calls already made)
3. README contains at least one fenced code block (simple substring count of ` ``` `)
**Why:** A cheap, honest proxy for "did someone invest in onboarding," without pretending to detect documentation *quality*.
**Can I collect it:** Yes — no crawling, no docs-site scraping, no attempt to verify examples actually run.
**Can I defend it:** Yes, specifically *because* it claims less. The original "detect runnable, language-tagged examples" idea sounds rigorous but isn't reliably implementable without executing untrusted code — better to score a narrower, honest thing well than a broader thing that silently guesses.

---

## 6. Normalization Strategy

**Global percentile rank against the validation benchmark set** (§10) — the same ~50–100 curated packages used for validation double as the reference population for normalization. This is the single biggest structural simplification in this document, and it's worth stating plainly why it's not a downgrade from the original's cohort-percentile approach:

- The complexity the original design paid for was the **archetype cohort split** (rank npm Utilities only against other npm Utilities). That's what's removed.
- Plain percentile rank — sort every package's raw value for a metric, your score is `rank / N × 100` — is retained, because it's genuinely simple ("sort and find your position") *and* it keeps the robustness-to-outliers property the original document specifically wanted (one viral package no longer compresses everyone else toward zero, since rank order is unaffected by how extreme the outlier is).
- A useful side effect: because percentile rank only cares about *order*, not magnitude, the log-transform-before-ranking step the original design needed for skewed metrics (downloads) becomes unnecessary for ranking purposes — rank is invariant to any monotonic transform. (The log transform inside the *growth* calculation in §5.5 is a different thing — it changes which packages count as "growing more," not just the scale — and is still needed there.)
- **Cold-start handling:** ranking against a fixed, curated 50–100 package set instead of a live growing corpus means normalization is cheap, static, and doesn't need a "recompute every percentile on every new ingest" pipeline. A package outside the benchmark set is ranked against it as an external reference population — simple to implement, easy to explain.

Percentile rank against a much larger, live, non-curated corpus, split by archetype, is the natural v2 upgrade once there's enough volume for that split to be statistically meaningful (§12).

---

## 7. Weighting Strategy

**One global weight vector.** No archetype tables.

| Metric | Weight |
|---|---:|
| Commit Cadence | 20% |
| Release Frequency | 15% |
| Issue Resolution Health | 20% |
| Contributor Concentration | 15% |
| Download Momentum | 20% |
| Documentation Presence | 10% |

These are **starting hypotheses**, explicitly not validated results. Their only job in v1 is to be simple enough to state from memory and be visibly, individually adjustable when validation (§10) turns up a mismatch. Weight tuning is manual and documented — not auto-fit by regression — because a black-box weight-fitting step would undermine the transparency goal the whole project is built on. Every weight change gets a one-line written justification tied to a specific benchmark mismatch.

---

## 8. Health Score Formula

For the set of available metrics **A** (weights `w_i` summing to 1.0 across all 6 when complete, percentile scores `P_i` in [0, 100]):

```
HealthScore = ( Σ_{i∈A} w_i · P_i ) / ( Σ_{i∈A} w_i )
```

The final weighted-average Health Score is rounded to the nearest integer before being represented as the 0–100 Health Score.

This is a straightforward weighted average that automatically redistributes weight across whatever metrics are actually available — no separate redistribution logic needed, it falls out of the formula. If fewer than 4 of the 6 metrics are available, the API returns `insufficient_data` instead of a score built on a minority of the model.

---

## 9. Missing Data Handling

- A metric is never zero-filled. Unavailable ≠ unhealthy.
- Every response includes a completeness indicator:
  ```json
  {"health_score": 74, "metrics_available": 5, "metrics_total": 6}
  ```
- Packages younger than 90 days return `{"provisional": true}` — a single `created_at` date check, no added logic — since Release Frequency and Download Momentum are close to meaningless on a brand-new repo.
- Fewer than 4/6 metrics available → `{"score": null, "reason": "insufficient_data"}`.

---

## 10. Validation Methodology — the actual centerpiece

This is where v1's credibility is earned, and it should be written up as a distinct contribution in the dissertation, not an afterthought.

**10.1 Benchmark dataset.** Hand-curate 50–100 well-known npm/PyPI packages spanning four labelled tiers, assigned by the developer with written justification per package, cross-checked against objective external signals (GitHub `archived` flag, explicit deprecation notices in the README or package page, last-commit recency):

| Tier | Signal | Example type |
|---|---|---|
| Thriving | Active, widely adopted, regularly released | Major frameworks, widely-used libraries |
| Stable | Mature, low churn but not neglected | Long-stable utility libraries |
| Declining | Falling activity, community migrating away | Superseded tools with visible successor projects |
| Abandoned | No commits/releases in 12+ months, or explicitly archived | Deprecated packages, archived repos |

**10.2 Run the pipeline.** Compute Health Scores for the full benchmark set using the exact v1.0 methodology.

**10.3 Compare against perceived reality.** Use **Spearman's rank correlation** between the computed score and the assigned tier (ordinal 1–4). This is a standard, one-line calculation (`scipy.stats.spearmanr`), not a bespoke statistical method — appropriate rigor without inventing a validation framework from scratch.

**10.4 Root-cause mismatches.** For any package whose computed score contradicts its assigned tier, identify *which specific metric(s)* drove the disagreement (e.g., "abandoned package X still scores high because npm download counts lag actual usage by months — CI/mirror traffic inflation, exactly the disclosed §5.5 weakness"). Document each mismatch and the metric responsible.

**10.5 Recalibrate weights.** Adjust the global weight vector (§7) based on mismatch patterns — manually, with each change logged and justified against a specific finding, not fit automatically.

**10.6 Re-validate.** Re-run the corrected model against the same benchmark set, recompute Spearman's ρ, and report the delta. The before/after correlation improvement, with named examples of what changed and why, *is* the empirical contribution.

This turns "the weights are starting hypotheses" from a disclaimer into a tested claim.

---

## 11. Engineering Considerations

**11.1 Single refresh cycle.** No per-metric TTL matrix. All metrics for all benchmark packages refresh on one weekly batch job. Differentiated TTLs are a real optimization — for a system with real user load and real staleness complaints, neither of which exist yet. Building that matrix now is solving a problem you don't have.

**11.2 GitHub's async stats endpoints.** `/stats/contributors` can return `202 Accepted` with an empty body on a cold cache. This must be treated as "retry after backoff," never as "zero commits" — silently treating a 202 as zero would corrupt Commit Cadence and Contributor Concentration for any repo hit mid-cache-warm. This is a real, cheap-to-handle gotcha worth keeping in the write-up as evidence of engineering care, not evidence of overbuilding.

**11.3 Rate limiting.** REST-only, authenticated, 5,000 requests/hour. At benchmark scale (~100 packages × ~4 calls) this is comfortably inside budget without batching or GraphQL — do this arithmetic explicitly in the dissertation rather than asserting it.

**11.4 AI explanation layer — architectural separation, not just a prompt rule.** The score is computed and persisted first. A separate, stateless call then reads the already-stored `{health_score, metrics: [...], completeness}` object and produces a natural-language explanation. The explanation endpoint has no write path back to the score. This means "AI never influences the score" is enforced by the data flow, not just by an instruction the model could in principle ignore — a materially stronger answer in a viva than "we told the prompt not to."

---

## 12. Future Work (v2+)

Everything cut from v1 for sequencing reasons, not merit — this is the roadmap the original "v2.0" draft described, now correctly positioned as *after* a validated v1:

- **Archetype classification & archetype-specific weighting** — needs a large enough corpus per archetype for the weight differences to be meaningful; premature at 50–100 packages.
- **Cohort-based percentile normalization** (per registry + archetype) — natural successor to §6 once corpus size supports meaningful cohort sizes.
- **Full Bus Factor** (smallest-N contributors for ≥50% of commits) — upgrade path from §5.4 once the single-ratio proxy's limitations are empirically visible in validation mismatches.
- **Ecosystem Dependents Ratio** — requires a fourth data source (Libraries.io or npms.io) outside the GitHub/npm/PyPI boundary; correctly out of scope until that boundary is deliberately expanded.
- **Bot-aware stale-issue-closure filtering** — needs per-issue event/label inspection (GraphQL likely justified at that point), deferred from §5.3.
- **Release cadence variance** (coefficient of variation) — reintroduce once packages in the corpus have enough release history for the statistic to be meaningful, per the original §4.2 insufficient-data reasoning.
- **Differentiated per-metric TTLs and staleness-aware freshness reporting** — justified once there's real refresh-cost or real-time-accuracy pressure from actual usage.
- **crates.io / RubyGems ecosystem expansion** — same 6-metric model, new ecosystem-specific data adapters.
- **Weight auto-calibration** (e.g., regression against benchmark labels) — only after the manual, documented calibration in §10 has been run at least once, so there's a transparent baseline to compare an automated approach against.

---

## Changelog

- **v1.0** (this document): MVP implementation target. 6 metrics (Dependents Ratio removed), single global weight vector, percentile-rank-against-benchmark-set normalization, REST-only data collection, formal validation methodology introduced as a first-class deliverable.
- **Prior draft** ("v2.0"): Full target design — archetype classification, cohort normalization, corrected Bus Factor, 7 metrics including Dependents Ratio. Retained as the v2+ roadmap (§12).
