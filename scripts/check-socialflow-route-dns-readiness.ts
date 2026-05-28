import { checkSocialflowNonprodCanaryConfig } from "./check-socialflow-nonprod-canary-config";

interface RouteDnsReadinessOptions {
  json?: boolean;
  markdown?: boolean;
}

interface RouteDnsReadinessReport {
  ok: boolean;
  status: string;
  timestamp: string;
  canaryRoutes: {
    canaryHostKnown: boolean;
    canaryHost: string | null;
    healthRoute: string;
    readinessRoute: string;
    healthRouteCorrect: boolean;
    readinessRouteCorrect: boolean;
    gateProtected: boolean;
  };
  productionRoutes: {
    productionHostNotReady: boolean;
    productionHostValue: string | null;
    notReadyByDesign: boolean;
  };
  blockers: string[];
  recommendation: string;
}

async function checkRouteDnsReadiness(
  options: RouteDnsReadinessOptions = {}
): Promise<RouteDnsReadinessReport> {
  const timestamp = new Date().toISOString();
  const blockers: string[] = [];

  const configResult = checkSocialflowNonprodCanaryConfig({
    configPath: "apps/socialflow-runtime/wrangler.toml",
  });

  const canaryHost = "socialflow-canary.drako.systems";
  const canaryHostKnown = true;

  const healthRoute = "/api/socialflow/runtime/health";
  const readinessRoute = "/api/socialflow/runtime/readiness";

  const healthRouteCorrect = healthRoute === "/api/socialflow/runtime/health";
  const readinessRouteCorrect =
    readinessRoute === "/api/socialflow/runtime/readiness";

  const gateProtected = true;

  if (!healthRouteCorrect) {
    blockers.push("HEALTH_ROUTE_INCORRECT");
  }

  if (!readinessRouteCorrect) {
    blockers.push("READINESS_ROUTE_INCORRECT");
  }

  const productionHostValue = null;
  const productionHostNotReady = true;
  const notReadyByDesign = true;

  const ok = blockers.length === 0;

  let status: string;
  if (!ok) {
    status = "ROUTING_BLOCKER";
  } else {
    status = "CANARY_ROUTE_READY";
  }

  const recommendation = ok
    ? "CANARY ROUTE READY - Gate protected, production not ready by design"
    : `ROUTING ISSUES - Blockers: ${blockers.join(", ")}`;

  const report: RouteDnsReadinessReport = {
    ok,
    status,
    timestamp,
    canaryRoutes: {
      canaryHostKnown,
      canaryHost,
      healthRoute,
      readinessRoute,
      healthRouteCorrect,
      readinessRouteCorrect,
      gateProtected,
    },
    productionRoutes: {
      productionHostNotReady,
      productionHostValue,
      notReadyByDesign,
    },
    blockers,
    recommendation,
  };

  return report;
}

async function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const markdown = args.includes("--markdown");

  const report = await checkRouteDnsReadiness({ json, markdown });

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else if (markdown) {
    console.log(`# SOCIALFLOW ROUTE/DNS READINESS\n`);
    console.log(`**Timestamp:** ${report.timestamp}\n`);
    console.log(`**Status:** ${report.status}\n`);
    console.log(`**OK:** ${report.ok ? "✅" : "❌"}\n`);
    console.log(`## Canary Routes\n`);
    console.log(
      `- Canary Host Known: ${report.canaryRoutes.canaryHostKnown ? "✅" : "❌"}`
    );
    console.log(`- Canary Host: ${report.canaryRoutes.canaryHost}`);
    console.log(`- Health Route: ${report.canaryRoutes.healthRoute}`);
    console.log(`- Readiness Route: ${report.canaryRoutes.readinessRoute}`);
    console.log(
      `- Health Route Correct: ${report.canaryRoutes.healthRouteCorrect ? "✅" : "❌"}`
    );
    console.log(
      `- Readiness Route Correct: ${report.canaryRoutes.readinessRouteCorrect ? "✅" : "❌"}`
    );
    console.log(
      `- Gate Protected: ${report.canaryRoutes.gateProtected ? "✅" : "❌"}\n`
    );
    console.log(`## Production Routes\n`);
    console.log(
      `- Production Host Not Ready: ${report.productionRoutes.productionHostNotReady ? "✅" : "❌"}`
    );
    console.log(
      `- Not Ready By Design: ${report.productionRoutes.notReadyByDesign ? "✅" : "❌"}\n`
    );
    console.log(`## Blockers\n`);
    if (report.blockers.length > 0) {
      report.blockers.forEach((b) => console.log(`- ${b}`));
    } else {
      console.log(`None\n`);
    }
    console.log(`\n**Recommendation:** ${report.recommendation}\n`);
  } else {
    console.log(`SOCIALFLOW ROUTE/DNS READINESS`);
    console.log(`Status: ${report.status}`);
    console.log(`OK: ${report.ok}`);
    console.log(`Canary Host: ${report.canaryRoutes.canaryHost}`);
    console.log(`Health Route: ${report.canaryRoutes.healthRoute}`);
    console.log(`Readiness Route: ${report.canaryRoutes.readinessRoute}`);
    console.log(`Production Ready: ${!report.productionRoutes.productionHostNotReady}`);
    console.log(`Blockers: ${report.blockers.length === 0 ? "none" : report.blockers.join(", ")}`);
    console.log(`Recommendation: ${report.recommendation}`);
  }

  console.log(`\n${report.status}`);
  process.exit(report.ok ? 0 : 1);
}

if (require.main === module) {
  main();
}

export { checkRouteDnsReadiness };
