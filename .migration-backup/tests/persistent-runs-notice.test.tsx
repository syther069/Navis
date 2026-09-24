import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  PERSISTENT_RUNS_NOTICE,
  PersistentRunsNotice,
} from "../components/decisions/persistent-runs-notice";

describe("persistent runs notice", () => {
  it("tells an owner plainly that live-mode agents cannot run yet and links to the demo", () => {
    const html = renderToStaticMarkup(<PersistentRunsNotice />);
    expect(html).toContain("Fresh decisions run only for demo-mode agents");
    expect(html).toMatch(/reserve, turnover, freshness, liquidity/);
    expect(html).toContain('href="/agents/atlas"');
    expect(html).not.toMatch(/<button/i);
    expect(PERSISTENT_RUNS_NOTICE.body).not.toMatch(/—/);
  });
});
