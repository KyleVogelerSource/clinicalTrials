import { Page, TestInfo, expect } from "@playwright/test";

export async function capture(page: Page, testInfo: TestInfo, name: string) {
  await expect(page.locator("body")).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath(`${slug(name)}.png`),
  });
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
