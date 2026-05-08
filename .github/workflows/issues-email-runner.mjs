import fetch from 'node-fetch';
import nodemailer from 'nodemailer';
import fs from 'fs';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER        = process.env.REPO_OWNER;
const REPO         = process.env.REPO_NAME;
const FROM_EMAIL   = process.env.SMTP_USER;
const FROM_PASS    = process.env.SMTP_PASS;
const TO_EMAIL     = process.env.EMAIL_TO;
const SMTP_HOST    = process.env.SMTP_HOST;
const SMTP_PORT    = parseInt(process.env.SMTP_PORT || '465', 10);
const SMTP_SECURE  = SMTP_PORT === 465;
const STATE_FILE   = '.issues-email-state.json';

for (const [k, v] of Object.entries({ GITHUB_TOKEN, OWNER, REPO, FROM_EMAIL, FROM_PASS, TO_EMAIL, SMTP_HOST })) {
  if (!v) throw new Error(`Missing required env var: ${k}`);
}

const GH_HEADERS = {
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${GITHUB_TOKEN}`,
};

// ── State ─────────────────────────────────────────────────────────────────────

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return null; }
}

function saveState(s) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

// ── EAT date helpers ──────────────────────────────────────────────────────────

function eatInfo() {
  const now = new Date();

  // Date string in EAT (Africa/Nairobi = UTC+3, no DST)
  const dateFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const dateStr = dateFmt.format(now); // "YYYY-MM-DD"

  // Day-of-week name in EAT
  const dowFmt = new Intl.DateTimeFormat('en', {
    timeZone: 'Africa/Nairobi', weekday: 'long',
  });
  const weekdayName = dowFmt.format(now);
  const DOW = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const dayOfWeek = DOW.indexOf(weekdayName); // 0=Sun … 6=Sat

  // ISO week ID — uses noon UTC on the EAT date to avoid any boundary issues
  const d = new Date(`${dateStr}T12:00:00Z`);
  const isoDay = d.getUTCDay() || 7; // 1=Mon … 7=Sun
  const thursday = new Date(d);
  thursday.setUTCDate(d.getUTCDate() + (4 - isoDay));
  const jan4 = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const weekNo = Math.ceil((((thursday - jan4) / 86400000) + 1) / 7);
  const weekId = `${thursday.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;

  // Monday of this ISO week
  const mondayD = new Date(`${dateStr}T12:00:00Z`);
  mondayD.setUTCDate(mondayD.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const mondayStr = mondayD.toISOString().slice(0, 10);

  // Display label ("Thursday, 8 May 2026")
  const labelFmt = new Intl.DateTimeFormat('en-KE', {
    timeZone: 'Africa/Nairobi',
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const label = labelFmt.format(now);

  // Midnight EAT as UTC ISO string (for GitHub API `since` param)
  const midnightISO = new Date(`${dateStr}T00:00:00+03:00`).toISOString();

  return { dateStr, dayOfWeek, weekId, mondayStr, label, midnightISO };
}

// ── GitHub ─────────────────────────────────────────────────────────────────────

async function fetchTodaysIssues(since) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/issues` +
              `?state=open&since=${since}&per_page=100&sort=created&direction=asc`;
  const res = await fetch(url, { headers: GH_HEADERS });
  if (!res.ok) throw new Error(`GitHub API error ${res.status}: GET /issues`);
  const all = await res.json();
  // `since` filters by updated_at; narrow to created_at to avoid already-emailed issues
  return all.filter(i => !i.pull_request && new Date(i.created_at) >= new Date(since));
}

// ── Email HTML ─────────────────────────────────────────────────────────────────

function buildHtml(issues, dateLabel) {
  const repoUrl = `https://github.com/${OWNER}/${REPO}`;

  const header = `
<div style="background:#1d4ed8;padding:18px 24px;border-radius:8px 8px 0 0;">
  <h2 style="color:#fff;margin:0;font-family:Arial,sans-serif;font-size:17px;font-weight:600;">
    Issues Agent — Daily Digest
  </h2>
  <p style="color:#bfdbfe;margin:5px 0 0;font-family:Arial,sans-serif;font-size:13px;">
    ${dateLabel} &nbsp;·&nbsp;
    <a href="${repoUrl}" style="color:#bfdbfe;">${OWNER}/${REPO}</a>
  </p>
</div>`;

  const footer = `
<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0 14px;">
<p style="color:#9ca3af;font-size:12px;font-family:Arial,sans-serif;margin:0;">
  <a href="${repoUrl}/issues" style="color:#9ca3af;">View all issues</a>
  &nbsp;·&nbsp; Sent by Issues Agent
</p>`;

  if (issues.length === 0) {
    return `<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;">
  ${header}
  <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:24px;">
    <p style="color:#6b7280;font-family:Arial,sans-serif;">No new issues were documented today.</p>
    ${footer}
  </div>
</div>`;
  }

  const blocks = issues.map(issue => {
    const badges = (issue.labels || []).map(l =>
      `<span style="display:inline-block;background:#e0e7ff;color:#3730a3;` +
      `padding:2px 10px;border-radius:9999px;font-size:11px;margin:0 4px 4px 0;">${l.name}</span>`
    ).join('');
    const body = (issue.body || '')
      .slice(0, 1500)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
    return `
<div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px 18px;margin-bottom:14px;">
  <h3 style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:14px;font-weight:600;">
    <a href="${issue.html_url}" style="color:#1d4ed8;text-decoration:none;">
      #${issue.number} — ${issue.title}
    </a>
  </h3>
  <div style="margin-bottom:10px;">${badges}</div>
  <div style="color:#374151;font-family:Arial,sans-serif;font-size:13px;line-height:1.7;">${body}</div>
</div>`;
  }).join('');

  return `<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;">
  ${header}
  <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:24px;">
    <p style="color:#374151;font-family:Arial,sans-serif;margin:0 0 18px;font-size:14px;">
      <strong>${issues.length} issue${issues.length !== 1 ? 's' : ''}</strong> documented today
    </p>
    ${blocks}
    ${footer}
  </div>
</div>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n📧 Issues Email Digest — ${OWNER}/${REPO}\n`);

  const { dateStr, weekId, mondayStr, label, midnightISO } = eatInfo();
  console.log(`Today (EAT): ${dateStr}  |  Week: ${weekId}`);

  const issues = await fetchTodaysIssues(midnightISO);
  console.log(`Issues created today: ${issues.length}`);

  const state     = loadState();
  const newThread = !state || state.weekId !== weekId;
  const msgId     = `issues-agent-${dateStr}-${OWNER}@github.actions`;

  let subject, extraHeaders;

  if (newThread) {
    subject      = `Issues Agent — Week of ${mondayStr} | ${OWNER}/${REPO}`;
    extraHeaders = {};
    console.log('📬 Starting new weekly thread');
  } else {
    subject      = `Re: Issues Agent — Week of ${state.weekMondayDate} | ${OWNER}/${REPO}`;
    const refs   = (state.allMsgIds || []).map(id => `<${id}>`).join(' ');
    extraHeaders = {
      'In-Reply-To': `<${state.lastMsgId}>`,
      'References':  refs,
    };
    console.log(`↩️  Replying to: <${state.lastMsgId}>`);
  }

  const transporter = nodemailer.createTransport({
    host:   SMTP_HOST,
    port:   SMTP_PORT,
    secure: SMTP_SECURE,
    auth:   { user: FROM_EMAIL, pass: FROM_PASS },
    tls:    { rejectUnauthorized: false },
  });

  await transporter.sendMail({
    from:      FROM_EMAIL,
    to:        TO_EMAIL,
    subject,
    html:      buildHtml(issues, label),
    messageId: `<${msgId}>`,
    headers:   extraHeaders,
  });

  console.log(`✓ Email sent to ${TO_EMAIL}`);

  const prevIds = newThread ? [] : (state.allMsgIds || []);
  saveState({
    weekId,
    weekMondayDate: newThread ? mondayStr : state.weekMondayDate,
    lastMsgId:      msgId,
    allMsgIds:      [...prevIds, msgId],
    lastEmailDate:  dateStr,
  });

  console.log(`✅ Thread state saved.\n`);
}

run().catch(err => {
  console.error('❌ Email digest error:', err.message);
  process.exit(1);
});
