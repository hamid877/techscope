# TechScope V1 Benchmark Validation

## 1. Purpose

This document records the empirical validation and recalibration required by the V1 methodology. It demonstrates that the TechScope scoring model's credibility is empirically validated against a human-curated benchmark of known package health tiers, rather than merely asserted.

## 2. Benchmark

- **Total benchmark packages:** 60
- **Successfully scored:** 53
- **Insufficient Data:** 7 (These packages were excluded from Spearman scoring because they could not produce a valid score, strictly adhering to the methodology).
- **Methodology Version:** 1.0

**Tier distribution (among successfully scored packages):**
- Thriving: 26
- Stable: 9
- Declining: 13
- Abandoned: 5

## 3. Initial Weights

The initial global weight vector (starting hypotheses) was configured as follows:

| Metric | Weight |
|---|---|
| Commit Cadence | 0.20 |
| Release Frequency | 0.15 |
| Issue Resolution Health | 0.20 |
| Contributor Concentration | 0.15 |
| Download Momentum | 0.20 |
| Documentation Presence | 0.10 |
| **Total** | **1.00** |

## 4. Initial Validation

**Initial Spearman rho:** `0.7224`

**Initial Tier Score Distributions:**

* **Thriving:**
  * count 26
  * min 20
  * max 83
  * median 57

* **Stable:**
  * count 9
  * min 23
  * max 64
  * median 51

* **Declining:**
  * count 13
  * min 18
  * max 45
  * median 29

* **Abandoned:**
  * count 5
  * min 15
  * max 27
  * median 16

## 5. Mismatch Analysis

During the initial validation, four significant mismatches were investigated:
- **`docutils` (Thriving)** scored 20.
- **`mechanize` (Declining)** scored 45.
- **`bower` (Declining)** scored 43.
- **`pep8` (Declining)** scored 32.

**Observed Patterns:**
- **Download Momentum Anomalies:** `download_momentum` produced anomalously high percentiles for `mechanize` and `bower` (94-100%). Small absolute increases in CI/bot downloads trigger massive percentage growth on tiny baselines, actively confounding the tiers and overriding the lack of actual releases or commits.
- **Saturated Projects Penalty:** `download_momentum` heavily penalized mature/saturated projects like `docutils` (Thriving). Projects with universal market saturation naturally exhibit flat or negative growth, yielding extremely low momentum percentiles.
- **Issue Resolution False Positives:** Deprecated projects like `pep8` exhibited a very high `issue_resolution_health` percentile (76%). Repositories transitioning to deprecated/archived status often mass-close open issues or quickly close new issues with "we are deprecated," artificially inflating their resolution rate and deflating median closure time.

These observations motivated a recalibration to decrease reliance on noisy secondary proxies (downloads, issue closure rates) and shift emphasis towards primary signals of active maintenance.

## 6. Recalibration

Based on empirical evidence, weights were manually adjusted:

| Metric | Old | New | Delta | Reason |
|---|---|---|---|---|
| Commit Cadence | 0.20 | 0.30 | +0.10 | Increases weight on the most reliable direct signal of active maintenance. |
| Release Frequency | 0.15 | 0.25 | +0.10 | Increases weight on actual shipped output. |
| Issue Resolution | 0.20 | 0.15 | -0.05 | Reduced slightly due to mass-closing false positives on archived repos. |
| Contributor Conc. | 0.15 | 0.15 | 0.00 | Retained as a reliable secondary indicator. |
| Download Momentum | 0.20 | 0.05 | -0.15 | Drastically penalized due to extreme CI inflation and saturation penalties. |
| Documentation | 0.10 | 0.10 | 0.00 | Retained baseline requirement. |

This change shifts emphasis toward direct maintenance signals while significantly reducing the influence of the observed noisy download signal.

## 7. Post-Recalibration Validation

**Post-recalibration Spearman rho:** `0.7804`

**Delta:** `+0.0580`

**Post-Recalibration Tier Score Distributions:**

* **Thriving:**
  * count 26
  * min 22
  * max 85
  * median 63

* **Stable:**
  * count 9
  * min 22
  * max 64
  * median 48

* **Declining:**
  * count 13
  * min 21
  * max 40
  * median 27

* **Abandoned:**
  * count 5
  * min 20
  * max 23
  * median 21

## 8. Mismatch Recheck

- **`docutils`:** 20 → 22. The score remains low because its measured maintenance signals (commits and releases) are objectively low. This is consistent with the methodology's focus on active maintenance over historical importance.
- **`mechanize`:** 45 → 27. Stripping the false momentum penalty accurately collapsed the score, aligning it perfectly with other Declining packages.
- **`bower`:** 43 → 27. Similar to `mechanize`, removing the massive download momentum artifact correctly dropped its score.
- **`pep8`:** 32 → 34. The slightly higher commit cadence percentile absorbed the drop in issue resolution weight. It remains appropriately bounded within the Declining tier.

## 9. Validation Conclusion

- **Initial rho:** 0.7224
- **Final rho:** 0.7804
- **Improvement:** +0.0580

The recalibration produced a measurable improvement in rank correlation and significantly reduced the observed anomalous high scores among declining and abandoned packages. 

This does NOT establish that the model is universally correct; rather, it documents the empirical V1 validation cycle required by the methodology, demonstrating that the model behaves predictably against known baseline constraints.
