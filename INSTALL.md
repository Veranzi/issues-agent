# Quick Install

1. **Copy** `issues-agent.yml` and `issues-agent-runner.mjs` into your repo's `.github/workflows/` directory.

2. **Add secret** in your GitHub repo:
   - **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `ANTHROPIC_API_KEY`
   - Value: get one at https://console.anthropic.com/settings/keys

3. **Push** to main:

   ```bash
   mkdir -p .github/workflows
   # ...drop the two files in...
   git add .github/workflows/
   git commit -m "Add Issues Agent"
   git push
   ```

Watch it run in the **Actions** tab. After ~30s, your **Issues** tab fills up.

See [README.md](README.md) for full docs, configuration, and troubleshooting.
