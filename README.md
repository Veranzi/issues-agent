# Issues Agent

A GitHub Action that auto-documents your codebase as GitHub Issues using Claude.

On the first run it scans the repo and creates one Issue per major piece of functionality.
After that, every push to `main` creates one Issue per new commit, summarising what
was added/fixed/refactored. Each Issue gets sensible labels (`feature`, `bug`,
`refactor`, etc.) and a footer linking back to the commit and author.

## What you get

After installing, your **Issues** tab fills automatically:

```
#42  Add CBE notes ingestion script               [feature, documentation]
#43  Fix Postgres BOOLEAN bug in content-service  [bug, refactor]
#44  Wrap RegisterPage in Suspense boundary       [bug]
#45  Add manual Pochi payment flow                [feature, payment]
```

Useful for: solo founders who want a paper trail without writing one, OSS maintainers
who want auto-changelogs as Issues, teams who want to surface what each PR actually changed.

---

## Install (3 minutes)

### 1. Copy the two files into your repo

From this folder, copy these into **your repo's `.github/workflows/` directory**:

```
issues-agent.yml          →  .github/workflows/issues-agent.yml
issues-agent-runner.mjs   →  .github/workflows/issues-agent-runner.mjs
```

If `.github/workflows/` doesn't exist yet, create it first.

### 2. Add your Anthropic API key as a secret

1. Go to your GitHub repo → **Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Name: `ANTHROPIC_API_KEY`
4. Value: get one at [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) (starts with `sk-ant-...`)
5. Click **Add secret**

That's it for required setup. The agent posts Issues using the workflow's built-in `GITHUB_TOKEN` — no PAT needed (the workflow YAML already declares the right `permissions:`).

### 3. Push and watch it run

```bash
git add .github/workflows/
git commit -m "Add Issues Agent"
git push
```

Open your repo's **Actions** tab → you should see "Issues Agent" running. After ~30s, check the **Issues** tab — auto-generated Issues should appear there.

---

## How it works

```
┌─────────┐  push    ┌──────────────┐
│ git push│ ───────► │ Issues Agent │
└─────────┘          │  (workflow)  │
                     └──────┬───────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
      ┌──────────────┐            ┌──────────────┐
      │ Read commits │            │ Read code    │
      │ since last   │            │ files        │
      │ run          │            │ (first run)  │
      └──────┬───────┘            └──────┬───────┘
             │                           │
             └─────────────┬─────────────┘
                           ▼
                   ┌──────────────┐
                   │   Claude     │
                   │ (sonnet-4-5) │
                   └──────┬───────┘
                          ▼
                  ┌───────────────┐
                  │ Post Issues   │
                  └───────────────┘
                          ▼
                  ┌───────────────┐
                  │ Save state    │
                  │ → next push   │
                  │   resumes     │
                  └───────────────┘
```

**State persistence**: the workflow uses [`actions/cache`](https://github.com/actions/cache)
to store the last-processed commit SHA between runs. This means subsequent runs only
document **new** commits — no re-documenting the whole codebase on every push.

**First-run behaviour**: with no cache hit, the agent does a full scan — top 15 source
files in the repo + the last 50 commits — and posts one Issue per item.

---

## Configuration

Edit the constants at the top of `issues-agent-runner.mjs`:

```js
const STATE_FILE = '.issues-agent-state.json';      // where state is cached
```

Edit the model in `claudeAnalyze()`:

```js
model: 'claude-sonnet-4-5',          // sonnet-4-5 (fast, accurate, cheap)
                                     // claude-opus-4-5 for higher quality
                                     // claude-haiku-4-5 for cheaper/faster
```

Edit the file-extensions list to match your stack:

```js
const CODE_EXTS = ['.js','.ts','.jsx','.tsx','.py','.java','.kt','.go','.rb','.cs','.cpp','.c','.php','.swift'];
```

Edit the workflow trigger to change *when* it runs:

```yaml
on:
  push:                       # default: every push to main/master
    branches: [main, master]

  # OR: once a day instead
  # schedule:
  #   - cron: '0 9 * * *'    # 9am UTC daily

  # OR: only on tagged releases
  # push:
  #   tags: ['v*']

  workflow_dispatch:           # always keep this — manual trigger button
```

---

## Cost

Each run calls Anthropic ~1–3 times. Per-run cost on `claude-sonnet-4-5`:

| Activity                       | Tokens (approx)     | Cost                |
|--------------------------------|---------------------|---------------------|
| Code scan (first run only)     | ~5K in / 2K out     | ~$0.05              |
| Commit summary (per ~10 commits) | ~3K in / 2K out   | ~$0.04              |

So ~$0.04–0.10 per push. For a team pushing ~10 times/day that's roughly **$10–25/month**.

To reduce: switch to `claude-haiku-4-5` (~5× cheaper), or change the trigger to run
once a day instead of on every push.

---

## Troubleshooting

### Workflow never appears in the Actions tab
The files must be at `.github/workflows/...` — GitHub doesn't scan elsewhere.

### Workflow runs but no Issues appear (silent success)
You're probably missing `ANTHROPIC_API_KEY`. The runner now throws clearly when that's
the case — open the failed run's log → expand **Run Issues Agent** → look for the error.

### "Cache save failed" warning
First run creates a fresh cache. That warning is harmless on the first run — the next
run will read the cache normally.

### "Resource not accessible by integration" (403)
The default `GITHUB_TOKEN` lacks `issues: write`. Check your `permissions:` block in
`issues-agent.yml` is present:

```yaml
permissions:
  issues: write
  contents: read
```

If your repo or org has stricter org-level token defaults, generate a fine-grained
PAT with `Issues: Read and write`, add it as a repo secret named `ISSUES_AGENT_TOKEN`,
and the workflow will prefer it.

### I want to backfill all old commits
Delete the saved cache and re-run:
1. Repo → **Actions** → left sidebar **Caches** → find `issues-agent-state-...` → **Delete**
2. **Actions** → **Issues Agent** → **Run workflow**

The agent will treat it as a first run and document everything.

### Too many Issues / want to undo
Bulk-close them via the GitHub UI: Issues tab → select all → **Mark as** → **Closed**.
Or use `gh`:

```bash
gh issue list --state open --limit 1000 --json number --jq '.[].number' \
  | xargs -I {} gh issue close {} --reason "not planned"
```

---

## License

MIT — feel free to copy, modify, and share.

## Credits

Built with [Anthropic Claude](https://www.anthropic.com/) and the GitHub REST API.
The cache-based incremental scan pattern is from
[`actions/cache`](https://github.com/actions/cache).
