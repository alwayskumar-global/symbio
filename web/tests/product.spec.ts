import { test, expect, type Page } from "@playwright/test";
const shots = "../docs/screenshots/";
async function shot(p: Page, n: string) {
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.screenshot({ path: shots + n + ".png", animations: "disabled" });
  await expect(p.getByText("Preview state", { exact: true })).toHaveCount(0);
}
test("live graph → opportunity → evidence → compared and stressed saved plans", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Proposed processing package" }),
  ).toBeVisible();
  await shot(page, "network");
  await page
    .getByRole("button", { name: "NovoGro residue", exact: true })
    .click();
  await expect(page.locator(".insp__h")).toHaveText("NovoGro residue");
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.getByRole("table").first()).toBeVisible();
  await page.getByRole("link", { name: "Opportunities", exact: true }).click();
  await expect(page.getByText("Configuration summary")).toBeVisible();
  await shot(page, "opportunity");
  await page
    .getByRole("button", { name: "Authorization state", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("link", { name: "Open full evidence detail" }).click();
  await expect(
    page.getByRole("heading", { name: "Authorization state" }),
  ).toBeVisible();
  await expect(
    page.getByText("Source & location", { exact: true }),
  ).toBeVisible();
  await shot(page, "evidence");
  await page.getByRole("link", { name: "Return to opportunities" }).click();
  await page.getByRole("link", { name: "Compare options" }).click();
  await expect(page.getByText("Retain the existing arrangement")).toBeVisible();
  await expect(page.getByText("1 · tied", { exact: true })).toHaveCount(4);
  await page
    .getByRole("radio", { name: /Transferable nutrient delivery/ })
    .check();
  await expect(page.getByText("Pending inputs differ")).toBeVisible();
  await page.getByRole("button", { name: "Evaluate options" }).click();
  await expect(
    page.getByText("2,000 wet t/year leads under normal operation"),
  ).toBeVisible();
  await expect(page.getByText("772.91", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/306.88 MWh/).first()).toBeAttached();
  await shot(page, "comparison");
  await page
    .getByRole("link", { name: "Inspect supplier-loss scenarios" })
    .click();
  await page.getByLabel("Saved scenario").selectOption("remove-supplier-yeast");
  await page.getByLabel("Saved option").selectOption("site-a-intake-500");
  await expect(page.locator(".reco")).toContainText("153.44");
  await shot(page, "disruptions");
  await page
    .getByRole("button", { name: "Processor capacity", exact: true })
    .click();
  await page.getByLabel("Remaining capacity (%)", { exact: true }).fill("40");
  await page
    .locator("label")
    .filter({ hasText: /^Processor / })
    .locator("select")
    .selectOption("site-a-intake-2000");
  await page.getByRole("button", { name: "Run disruption test" }).click();
  await expect(page.locator(".reco")).toContainText("40% remaining");
  const url = page.url();
  await page.reload();
  await expect(page.locator(".reco")).toContainText("40% remaining");
  expect(page.url()).toBe(url);
  expect(errors).toEqual([]);
});
test("errors, retry and unavailable claims", async ({ page }) => {
  await page.goto("/#/comparison");
  await expect(page.locator(".reco")).toBeVisible();
  await page.route("**/api/v1/evaluations", (r) =>
    r.fulfill({ status: 503, body: "offline" }),
  );
  await page.getByRole("button", { name: "Evaluate options" }).click();
  await expect(page.getByRole("alert")).toContainText("503");
  await expect(page.locator(".reco")).toBeVisible();
  await page.unroute("**/api/v1/evaluations");
  await page.getByText("Retry evaluation").click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.goto("/#/evidence/absent");
  await expect(page.getByRole("alert")).toContainText("unavailable");
  await page.getByRole("link", { name: "Return to network" }).click();
  await expect(
    page.getByRole("heading", { name: "Network explorer" }),
  ).toBeVisible();
});
test("mobile layout, filtered empty state and keyboard drawer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/network?types=Processing&hyp=0");
  await expect(
    page.getByText("No entities match these filters."),
  ).toBeVisible();
  await page.getByText("Clear filters", { exact: true }).click();
  await page
    .locator(".insp")
    .getByRole("button", { name: "Authorization state" })
    .click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.locator(".insp").getByRole("button", { name: "Authorization state" }),
  ).toBeFocused();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

test("a slow superseded evaluation cannot replace a newer result", async ({
  page,
}) => {
  await page.goto("/#/comparison");
  await expect(page.locator(".reco")).toBeVisible();
  let release!: () => void;
  const hold = new Promise<void>((r) => (release = r));
  await page.route("**/api/v1/evaluations", async (r) => {
    const reply = await r.fetch();
    if (r.request().postDataJSON().assumption_set === "protected") await hold;
    await r.fulfill({ response: reply }).catch(() => {});
  });
  await page.getByRole("radio", { name: /Protected direct delivery/ }).check();
  await page.getByText("Evaluate options", { exact: true }).click();
  await expect(page.getByText(/Recalculating · previous/)).toBeVisible();
  await page
    .getByRole("radio", { name: /Transferable nutrient delivery/ })
    .check();
  await page.getByText("Evaluate options", { exact: true }).click();
  await expect(page.getByText(/Recalculating · previous/)).toHaveCount(0);
  release();
  await expect(page.locator(".ctxbar")).toContainText(
    "Transferable nutrient delivery",
  );
  await expect(page.locator(".reco")).toContainText("2,000 wet t/year leads");
});
test("infeasible saved plan retains status and withholds numerical results", async ({
  page,
}) => {
  await page.route("**/api/v1/plans/*", async (r) => {
    const res = await r.fetch();
    const p = await res.json();
    await r.fulfill({
      json: {
        ...p,
        status: "infeasible",
        objective: null,
        reason: "Receiving bound below commitment (test fixture)",
        allocations: [],
        constraints: [],
      },
    });
  });
  await page.goto("/#/comparison");
  await expect(page.locator("#saved-plan")).toContainText(
    "Receiving bound below commitment",
  );
  await page.getByRole("button", { name: "Constraints", exact: true }).click();
  await expect(page.locator("#saved-plan")).toContainText("Slack / year");
});

test("standalone plan deep link resolves its persisted evaluation", async ({
  page,
  request,
}) => {
  const response = await request.post("/api/v1/evaluations", {
    data: { assumption_set: "transferable" },
  });
  const result = await response.json();
  const plan = result.plans.find(
    (p: { candidate: string; scenario: string }) =>
      p.candidate === "site-a-intake-500" &&
      p.scenario === "remove-supplier-yeast",
  );
  await page.goto("/#/disruptions?plan=" + plan.id);
  await expect(page.locator("#saved-plan")).toContainText(plan.id);
  await expect(page.locator(".reco")).toContainText("153.44");
});
