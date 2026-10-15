import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("landing page loads real campaigns and all local imagery", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("Extraordinary");
  await expect(page.locator(".cause-card").first()).toBeVisible();
  await page.locator(".volunteer-photo").scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator("img").evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0))).toBe(true);
  expect(errors).toEqual([]);
});

test("cause filters use the API, including empty categories", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Education", exact: true }).click();
  await expect(page.locator(".cause-card").first()).toBeVisible();
  for (const tag of await page.locator(".cause-card-tag").allTextContents()) expect(tag).toBe("education");
  await page.getByRole("button", { name: "Environment", exact: true }).click();
  await expect(page.getByText("New possibilities are on their way.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore volunteer opportunities" })).toBeVisible();
  await page.getByRole("button", { name: "All causes", exact: true }).click();
  await expect(page.locator(".cause-card").first()).toBeVisible();
});

test("campaign card opens the original detail and donation flow", async ({ page }) => {
  await page.goto("/");
  const campaign = page.locator(".cause-card").first();
  await expect(campaign).toBeVisible();
  const title = await campaign.locator("h3").innerText();
  await campaign.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await page.getByRole("link", { name: "Donate to this cause", exact: true }).click();
  await expect(page).toHaveURL(/\/campaigns\/\d+\/donate$/);
  await expect(page.getByLabel("Amount (INR)", { exact: true })).toBeVisible();
});

test("volunteer and sign-in forms remain reachable", async ({ page }) => {
  await page.goto("/");
  await page.locator(".hero-actions").getByRole("link", { name: "Become a volunteer" }).click();
  await expect(page.getByRole("heading", { name: "Register as a volunteer" })).toBeVisible();
  await expect(page.getByLabel("Full name", { exact: true })).toBeVisible();
  await page.locator("header").getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
});

test("mobile menu traps focus, closes on Escape and navigates", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Open menu", exact: true });
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "Menu", exact: true })).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  await trigger.click();
  await page.getByRole("dialog").getByRole("link", { name: "Volunteer", exact: true }).click();
  await expect(page).toHaveURL(/\/events$/);
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("header links scroll to the correct home section from another route", async ({ page }) => {
  await page.goto("/campaigns");
  await page.locator("header").getByRole("link", { name: "Our impact", exact: true }).click();
  await expect(page).toHaveURL(/\/#impact$/);
  await expect.poll(() => page.locator("#impact").evaluate((node) => Math.round(node.getBoundingClientRect().top))).toBeGreaterThanOrEqual(0);
  await expect.poll(() => page.locator("#impact").evaluate((node) => Math.round(node.getBoundingClientRect().top))).toBeLessThan(200);
});

test("FAQ expands and collapses with accessible state", async ({ page }) => {
  await page.goto("/");
  const question = page.getByRole("button", { name: "How do I become a volunteer?", exact: true });
  await question.click();
  await expect(question).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("region", { name: "How do I become a volunteer?" })).toBeVisible();
  await question.click();
  await expect(question).toHaveAttribute("aria-expanded", "false");
});

test("reduced motion disables smooth scrolling and decorative animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("Small acts.");
  expect(await page.locator("html").getAttribute("class") ?? "").not.toContain("lenis");
  expect(await page.locator(".hero-note-bottom").evaluate((node) => getComputedStyle(node).animationName)).toBe("none");
  await expect(page.locator(".hero-illustration")).toBeVisible();
});

test("campaign failures show a working retry without hiding the home page", async ({ page }) => {
  let fail = true;
  await page.route("**/api/v1/campaigns?**", (route) => {
    if (fail && new URL(route.request().url()).searchParams.get("page_size") === "3") return route.fulfill({ status: 503, json: { detail: "Temporarily unavailable" } });
    return route.continue();
  });
  await page.goto("/");
  await expect(page.locator(".campaign-results").getByRole("alert")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("h1")).toBeVisible();
  fail = false;
  await page.locator(".campaign-results").getByRole("button", { name: "Try again" }).click();
  await expect(page.locator(".cause-card").first()).toBeVisible();
});

test("layouts fit phone, tablet and desktop widths without horizontal overflow", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".cause-card").first()).toBeVisible();
  for (const width of [320, 390, 640, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const size = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
    expect(size.content, "Viewport " + width).toBeLessThanOrEqual(size.width);
    const heading = await page.locator("h1").boundingBox();
    expect(heading!.x + heading!.width).toBeLessThanOrEqual(width);
  }
});

test("home page meets automated WCAG A and AA checks", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".cause-card").first()).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })) }))).toEqual([]);
});
