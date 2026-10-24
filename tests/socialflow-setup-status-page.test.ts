import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function read(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("socialflow setup minimum pilot UX", () => {
  it("renders setup pages with minimum status flow instead of fail-closed boundary notice", () => {
    const webSetup = read("apps/socialcors/src/app/socialflow/(workspace)/setup/page.tsx");
    const runtimeSetup = read("apps/socialflow-runtime/src/app/socialflow/(workspace)/setup/page.tsx");

    for (const source of [webSetup, runtimeSetup]) {
      expect(source).toContain("/api/socialflow/setup/status");
      expect(source).toContain("Checklist minimo");
      expect(source).toContain("Human review obligatorio");
      expect(source).toContain("confirmPublish=true");
      expect(source).toContain("publishBlockedByPilotMode");
      expect(source).not.toContain("RuntimeBoundaryNotice");
    }
  });
});
