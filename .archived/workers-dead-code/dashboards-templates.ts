function buildSharedStyles(): string {
  return `
    :root {
      --bg-primary: #0b111a;
      --bg-secondary: #121b27;
      --bg-card: #192537;
      --text-primary: #e7eef8;
      --text-secondary: #9db0c7;
      --accent-primary: #38bdf8;
      --accent-muted: rgba(56, 189, 248, 0.18);
      --border-primary: rgba(157, 176, 199, 0.2);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", "Inter", sans-serif;
      background: radial-gradient(circle at top right, #182437 0%, var(--bg-primary) 48%);
      color: var(--text-primary);
      min-height: 100vh;
    }
    .shells {
      width: min(1080px, calc(100vw - 48px));
      margin: 40px auto;
      padding: 24px;
      border: 1px solid var(--border-primary);
      border-radius: 20px;
      background: linear-gradient(180deg, rgba(25, 37, 55, 0.95), rgba(11, 17, 26, 0.96));
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.32);
    }
    .heads {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 20px;
    }
    .titles { margin: 0; font-size: 28px; }
    .badges {
      padding: 8px 12px;
      border-radius: 999px;
      border: 1px solid var(--accent-primary);
      color: var(--accent-primary);
      background: var(--accent-muted);
      font-size: 12px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      font-weight: 700;
    }
    .grids {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 14px;
    }
    .cards {
      border: 1px solid var(--border-primary);
      border-radius: 14px;
      padding: 14px;
      background: var(--bg-card);
    }
    .labels {
      font-size: 11px;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
      font-weight: 700;
    }
    .values { margin: 0; font-size: 20px; font-weight: 700; }
    .foots {
      margin-top: 18px;
      color: var(--text-secondary);
      font-size: 13px;
    }
    a.links {
      color: var(--accent-primary);
      text-decoration: none;
      font-weight: 700;
    }
  `;
}

export function renderClientDashboards(params: {
  saasSlug: string;
  workerName: string;
  hostName: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${params.saasSlug} clients dashboards</title>
  <style>${buildSharedStyles()}</style>
</head>
<body>
  <main class="shells">
    <header class="heads">
      <div>
        <h1 class="titles">${params.saasSlug} clients dashboards</h1>
        <p class="foots">Workers-only runtime served by ${params.workerName}</p>
      </div>
      <span class="badges">${params.hostName}</span>
    </header>
    <section class="grids">
      <article class="cards"><div class="labels">active campaigns</div><p class="values">24</p></article>
      <article class="cards"><div class="labels">monthly usage</div><p class="values">73%</p></article>
      <article class="cards"><div class="labels">automation jobs</div><p class="values">112</p></article>
    </section>
    <p class="foots">Open <a class="links" href="/admins">admins dashboards</a> or check <a class="links" href="/api/health">/api/health</a>.</p>
  </main>
</body>
</html>`;
}

export function renderAdminDashboards(params: {
  saasSlug: string;
  workerName: string;
  hostName: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${params.saasSlug} admins dashboards</title>
  <style>${buildSharedStyles()}</style>
</head>
<body>
  <main class="shells">
    <header class="heads">
      <div>
        <h1 class="titles">${params.saasSlug} admins dashboards</h1>
        <p class="foots">Control tower mode with tenant guardrails and host fencing</p>
      </div>
      <span class="badges">${params.workerName}</span>
    </header>
    <section class="grids">
      <article class="cards"><div class="labels">tenants</div><p class="values">8</p></article>
      <article class="cards"><div class="labels">error budgets</div><p class="values">99.97%</p></article>
      <article class="cards"><div class="labels">auth isolation</div><p class="values">enforced</p></article>
    </section>
    <p class="foots">Host: ${params.hostName}. Open <a class="links" href="/clients">clients dashboards</a>.</p>
  </main>
</body>
</html>`;
}
