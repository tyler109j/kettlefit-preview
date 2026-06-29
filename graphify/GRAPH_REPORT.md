# Graph Report - kettlefit-dev  (2026-06-29)

## Corpus Check
- 31 files · ~58,182 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 425 nodes · 871 edges · 24 communities (22 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cab3a696`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]

## God Nodes (most connected - your core abstractions)
1. `h()` - 72 edges
2. `getState()` - 39 edges
3. `$()` - 26 edges
4. `clear()` - 23 edges
5. `showModal()` - 22 edges
6. `update()` - 20 edges
7. `root()` - 16 edges
8. `toast()` - 15 edges
9. `navTo()` - 13 edges
10. `renderWorkoutOverview()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `importJSON()` --calls--> `h()`  [EXTRACTED]
  js/app.js → js/ui.js
- `deloadSuggested()` --calls--> `getState()`  [EXTRACTED]
  js/engine.js → js/state.js
- `implicitLearning()` --calls--> `update()`  [EXTRACTED]
  js/progression.js → js/state.js
- `showUpdateBar()` --calls--> `h()`  [EXTRACTED]
  js/app.js → js/ui.js
- `renderSyncError()` --calls--> `h()`  [EXTRACTED]
  js/app.js → js/ui.js

## Import Cycles
- None detected.

## Communities (24 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (48): addXP(), allSetsPlanned(), anniversaryDue(), awardMicroChallenge(), capitalize(), dateDiffDays(), evaluateBadges(), identity() (+40 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (43): blockPhase(), buildCircuits(), buildSupersets(), buildWarmup(), buildWhy(), deloadSuggested(), EX_PER_DURATION, filterEligible() (+35 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (37): 1. Make superset a first-class format option (not auto-picked), 1. New goal slot: `sport`, 2. Exercise-level transfer metadata, 2. Replace long-press with a visible "Pair" action, 3. Engine bias, 3. Show *why* the engine paired what it paired, 4. Sport-specific volume tuning, 5. UI surface (+29 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (28): BODY_REGIONS, CHANGELOG_TAGS, doGenerate(), doSignOut(), download(), emptyState(), exportCSV(), exportJSON() (+20 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (29): aboutYouScreen(), badgeTile(), bodyMapPanel(), chipField(), clearData(), endowedScreen(), excludePanel(), exportWorkout() (+21 more)

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (24): adjustRest(), advanceCircuit(), advanceLinear(), buildSteps(), completeSet(), _defaultRepsFor(), dismissRest(), finalizePendingSet() (+16 more)

### Community 6 - "Community 6"
Cohesion: 0.19
Nodes (22): heatmap(), musclesTab(), nextOnb(), patternDistribution(), postFeels(), postNextPreview(), renderAuth(), renderIdleRing() (+14 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (8): _base64ToU8(), decodeState(), encodeState(), pullState(), pushState(), summarize(), supabase, _u8ToBase64()

### Community 8 - "Community 8"
Cohesion: 0.14
Nodes (13): clearAll(), _data, defaultState(), exportCSV(), exportJSON(), freshRecovery(), importJSON(), loadState() (+5 more)

### Community 9 - "Community 9"
Cohesion: 0.14
Nodes (18): afterLogin(), boot(), cap(), clearDemoData(), commitSession(), hasPersistedSession(), logBodyweight(), maybeShowUpdatePrompt() (+10 more)

### Community 10 - "Community 10"
Cohesion: 0.15
Nodes (11): AVAILABLE_BELLS, BASE_WEIGHT, FEELS, PRIMARY_GOAL, rand(), REPS, seedDemo(), TAG_POOL (+3 more)

### Community 11 - "Community 11"
Cohesion: 0.15
Nodes (11): bulletLines, CHANGELOG, changes, data, date, entry, m, plainLines (+3 more)

### Community 12 - "Community 12"
Cohesion: 0.18
Nodes (10): background_color, description, display, icons, name, orientation, scope, short_name (+2 more)

### Community 13 - "Community 13"
Cohesion: 0.24
Nodes (10): cfgChips(), clearPersistedSession(), collapsible(), formatLabel(), renderSessionConfig(), renderWorkoutOverview(), renderWorkoutTab(), restoreSessionFromStorage() (+2 more)

### Community 14 - "Community 14"
Cohesion: 0.47
Nodes (9): barChart(), C, countdownRing(), el(), fmt(), lineChart(), lineChartDual(), radarChart() (+1 more)

### Community 15 - "Community 15"
Cohesion: 0.31
Nodes (9): badgesSection(), feelsEmoji(), icStat(), overviewTab(), postSummary(), renderHome(), showAnniversary(), fmtNum() (+1 more)

### Community 16 - "Community 16"
Cohesion: 0.25
Nodes (7): Branches, How Hermes works here, KettleFit — Dev Workflow, Local preview, Versioning, What differs from production, What stays in sync with production

### Community 17 - "Community 17"
Cohesion: 0.40
Nodes (6): hasUnseenUpdate(), latestVersion(), rackEditor(), rackOnbScreen(), renderSettings(), toggleRow()

### Community 18 - "Community 18"
Cohesion: 0.33
Nodes (5): Commit message format, Manual run, Notes, Release automation, `release-changelog.yml`

### Community 19 - "Community 19"
Cohesion: 0.40
Nodes (4): Data, Development, KettleFit, Setup

## Knowledge Gaps
- **94 isolated node(s):** `Anim`, `NAV`, `onb`, `LB_WEIGHTS`, `KG_WEIGHTS` (+89 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getState()` connect `Community 0` to `Community 8`, `Community 1`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Why does `getStoredE1RM()` connect `Community 1` to `Community 0`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `update()` connect `Community 0` to `Community 8`, `Community 1`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `Anim`, `NAV`, `onb` to the rest of the system?**
  _94 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.060285563194077206 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.0693815987933635 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05263157894736842 - nodes in this community are weakly interconnected._