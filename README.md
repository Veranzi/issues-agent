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

## Email digest (optional)

A second workflow sends a daily email at **5 pm EAT** listing every issue created that
day. Each day's email is a **reply** in the same thread, so the whole week reads as a
single conversation trail in your inbox. The thread resets every Monday.

```
Monday     → new email  "Issues Agent — Week of 2026-05-04 | owner/repo"
Tuesday    → reply      "Re: Issues Agent — Week of 2026-05-04 | owner/repo"
Wednesday  → reply      (same thread)
...
Next Monday → new email  (fresh thread)
```

Two extra files are needed (same install pattern — copy to `.github/workflows/`):

- [`issues-email.yml`](issues-email.yml)
- [`issues-email-runner.mjs`](issues-email-runner.mjs)

Five GitHub secrets are required:

| Secret      | Value                                              |
|-------------|----------------------------------------------------|
| `SMTP_HOST` | Your mail server hostname (e.g. `mail.yourdomain.com`) |
| `SMTP_PORT` | `465` for SSL · `587` for STARTTLS                 |
| `SMTP_USER` | The email address used to log in to the SMTP server |
| `SMTP_PASS` | Password for that account                          |
| `EMAIL_TO`  | The address to deliver the digest to               |

Add them the same way as `ANTHROPIC_API_KEY` (repo → Settings → Secrets → Actions).

**Common provider settings:**

| Provider        | `SMTP_HOST`              | `SMTP_PORT` |
|-----------------|--------------------------|-------------|
| Custom / cPanel | `mail.yourdomain.com`    | `465`       |
| Gmail           | `smtp.gmail.com`         | `465`       |
| Outlook / M365  | `smtp.office365.com`     | `587`       |
| Yahoo           | `smtp.mail.yahoo.com`    | `465`       |

> **Gmail / Yahoo:** You must use an **App Password**, not your regular password.
> Generate one in your account's security settings and use it as `SMTP_PASS`.

> **Outlook / Microsoft 365:** SMTP AUTH must be enabled for the mailbox. In Microsoft
> 365 Admin Center go to *Users → Active users → [the account] → Mail → Manage email
> apps* and tick **Authenticated SMTP**.

---

## Install

Total time: **5–10 minutes** if you're new to GitHub Actions / Anthropic, **2 minutes** if you've done both before.

### Step 1 — Copy the two files into your repo

These two files live at the root of THIS repo:

- [`issues-agent.yml`](issues-agent.yml)
- [`issues-agent-runner.mjs`](issues-agent-runner.mjs)

You need to put them in your own repo's `.github/workflows/` folder. Pick whichever method you find easier:

**Option A — copy by hand**

1. In your local repo (the one you want documented), open a terminal at the repo root.
2. Create the workflows folder if it doesn't exist:
   ```bash
   mkdir -p .github/workflows
   ```
3. From your browser, open each file in this repo, click the **Raw** button, save the file with the same filename into `.github/workflows/` of your repo.

**Option B — one-liner with curl** (Linux/macOS/WSL/Git-Bash)

```bash
mkdir -p .github/workflows
curl -fsSL -o .github/workflows/issues-agent.yml https://raw.githubusercontent.com/Veranzi/issues-agent/main/issues-agent.yml
curl -fsSL -o .github/workflows/issues-agent-runner.mjs https://raw.githubusercontent.com/Veranzi/issues-agent/main/issues-agent-runner.mjs
```

If you also want the **email digest**, grab the two extra files:

```bash
curl -fsSL -o .github/workflows/issues-email.yml https://raw.githubusercontent.com/Veranzi/issues-agent/main/issues-email.yml
curl -fsSL -o .github/workflows/issues-email-runner.mjs https://raw.githubusercontent.com/Veranzi/issues-agent/main/issues-email-runner.mjs
```

Verify the files are now in your repo at:
```
.github/workflows/issues-agent.yml
.github/workflows/issues-agent-runner.mjs
.github/workflows/issues-email.yml          ← email digest (optional)
.github/workflows/issues-email-runner.mjs   ← email digest (optional)
```

> **Important:** GitHub Actions ONLY scans `.github/workflows/`. If you put them anywhere else, the workflow will never run.

---

### Step 2 — Get an Anthropic API key

#### 2a. If you don't have an Anthropic account yet

1. Go to **https://console.anthropic.com/**
2. Click **Sign up** (top-right). Use Google sign-in or email + password.
3. Verify your email by clicking the link Anthropic sends you.
4. Once you're inside the console, click **Plans & Billing** in the left sidebar.
5. Click **Add payment method** and enter a card. You'll be charged **per-API-call** (no monthly fee). Add at least **$5** of credit to start — that's enough for hundreds of Issues Agent runs.

#### 2b. Create the API key

1. Visit **https://console.anthropic.com/settings/keys** (or in the console: **Settings → API Keys**)
2. Click **Create Key** (top-right, blue button).
3. **Name**: type something descriptive like `Issues Agent for my-repo-name`.
4. **Workspace**: leave as Default unless you've created others.
5. Click **Create Key**.
6. **A key starting with `sk-ant-api03-...` appears in a dialog. COPY IT NOW.** Anthropic only shows you the full key once. If you close this dialog without copying, you'll need to delete the key and create a new one.
7. Paste the key somewhere safe — a password manager, or a temporary text file you'll delete after Step 3.

---

### Step 3 — Add the key as a GitHub repository secret

1. Open your repo on **github.com** in your browser (the same repo where you put the workflow files in Step 1).
2. Click the **Settings** tab. (It's at the top-right, next to Insights. You need admin access to the repo to see it.)
3. In the left sidebar, scroll down to the **Security** section.
4. Click **Secrets and variables** to expand it.
5. Click **Actions** (the option underneath "Secrets and variables").
6. You'll see three tabs at the top: *Secrets / Variables / Codespaces*. You're on **Secrets** — that's correct.
7. Click the green **New repository secret** button (top-right of the secrets list).
8. **Name** field: type exactly the following — case matters, no spaces, no quotes:
   ```
   ANTHROPIC_API_KEY
   ```
9. **Secret** field: paste the `sk-ant-api03-...` key you copied from Anthropic.
10. Click the green **Add secret** button.

The secret is now encrypted by GitHub. Even repo admins can never read it again — only the workflow can use it. You can safely delete the temporary copy you saved.

---

### Step 4 — Push and watch it run

In your terminal, in the repo where you put the workflow files:

```bash
git add .github/workflows/issues-agent.yml .github/workflows/issues-agent-runner.mjs
git commit -m "Add Issues Agent"
git push
```

Then:

1. Open your repo on github.com.
2. Click the **Actions** tab (next to Pull requests).
3. In the left sidebar you should see **Issues Agent** listed.
4. Click it — you'll see your push triggered a run.
5. Wait ~30 seconds for it to finish. A green check mark = success.
6. Click the **Issues** tab — auto-generated issues should be there.

**That's it.** Every future `git push` to `main` will auto-document the new commits. You don't need to do anything else.

---

### Don't have repo admin access?

You can still install this — but you'll need someone with admin rights to perform Step 3 (adding the secret). Send them this section as a request.

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

### Email digest: "Authentication unsuccessful" (535)
Your SMTP credentials are being rejected. Check in order:
1. `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS` secrets are all set correctly.
2. If using Gmail or Yahoo, `SMTP_PASS` must be an **App Password**, not your regular password.
3. If using Outlook / Microsoft 365, SMTP AUTH must be enabled on the mailbox (see Email digest section above).

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
