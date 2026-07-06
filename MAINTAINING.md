# Maintaining `vendor/paperclip`

This directory used to be a **git submodule** tracking a public fork of
[`paperclipai/paperclip`](https://github.com/paperclipai/paperclip) (MIT). As of **2026-06-27** it was
**folded into the mergatriod repo** as plain tracked files and turned into a private, self-owned project.
The original upstream MIT `LICENSE` was removed by project decision; the code is now governed by
mergatriod's terms (the repo ships no top-level license, i.e. all-rights-reserved / private).

> **Attribution note.** Paperclip's upstream is MIT (Copyright 2025 Paperclip AI). Removing the notice is
> fine for purely-private, non-distributed use. **If you ever distribute this or make it public, restore an
> MIT attribution notice for the inherited code** — that is the one thing the MIT terms require.

## The upstream lifeline (kept, fetch-only)

We deliberately keep the ability to pull upstream bug/security fixes without tracking the whole stream.
The connection lives on the **mergatriod** repo (not a submodule anymore):

- Remote: **`paperclip-upstream`** → `https://github.com/paperclipai/paperclip` (fetch-only; push disabled).
- Baseline: **`.upstream-base`** records the upstream commit our vendored tree corresponds to
  (currently `7069053a`). Bump it whenever you finish syncing up to a newer upstream point.

The public **fork** remote (`IAmMarcellus/paperclip`) was intentionally dropped. The full pre-fold history
(all branches + the 22 unpushed fork commits) is preserved as a self-contained bundle:

```
/home/marcellus/paperclip-fork-history.bundle      # 106M, "records a complete history"
git clone /home/marcellus/paperclip-fork-history.bundle paperclip-history   # restore if ever needed
```

> Move that bundle somewhere backed-up — it lives outside the repo and is your only copy of the granular
> fork commit history (it was never pushed to GitHub).

## Cadence

Every week or two:

```bash
make upstream-digest        # fetches paperclip-upstream, lists new commits since .upstream-base
```

Triage the list: **always** take security fixes; take features selectively. Then bring a fix in (below)
and **bump `.upstream-base`** to the upstream SHA you've caught up to.

## Bringing an upstream fix in

Upstream paths are repo-root-relative (`server/...`); here they live under `vendor/paperclip/`. Two ways:

```bash
# A) cherry-pick with subtree path-remapping (preferred for clean commits)
git fetch paperclip-upstream
git cherry-pick -x --strategy=subtree -Xsubtree=vendor/paperclip <upstream-commit>

# B) patch + apply under the prefix (robust fallback across unrelated history)
git fetch paperclip-upstream
git show <upstream-commit> | git apply -3 --directory=vendor/paperclip
```

## Keeping merges cheap (the real lifeline)

Cherry-picks apply in seconds or cost an afternoon depending on **where you add your own code**. Extend at
the seams upstream rarely rewrites — `server/src/adapters/` (the `opensage` adapter lives here), the plugin
loader, config — instead of rewriting core files upstream also edits. The pre-fold fork was almost entirely
additive (+14.7k / −0.6k) for exactly this reason; keep it that way and `upstream-digest` stays useful.
