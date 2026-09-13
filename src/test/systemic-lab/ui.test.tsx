import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SystemicLab from "../../systemic-lab/SystemicLab";

describe("Systemic Policy Desk shell", () => {
  it("renders the research boundary and accessible experiment controls", () => {
    const html = renderToStaticMarkup(<SystemicLab />);
    expect(html).toContain("Systemic Stress");
    expect(html).toContain("STYLIZED ECONOMIC SIMULATION");
    expect(html).toContain("Scenario and intervention controls");
    expect(html).toContain("Policy desk sections");
    expect(html).toContain("Run experiment");
  });
});
