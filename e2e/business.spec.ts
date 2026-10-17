import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";

const testPassword = randomBytes(18).toString("base64url");

test("yönetici ilk kurulumu ve günlük işletme akışı", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Yeni bir başlangıç." }),
  ).toBeVisible();
  await page.getByLabel("Adın soyadın").fill("Test Yöneticisi");
  await page.getByLabel("Şube adı", { exact: true }).fill("Merkez Şubesi");
  await page.getByLabel("Yönetici şifresi", { exact: true }).fill(testPassword);
  await page.getByRole("checkbox").uncheck();
  await page.getByRole("button", { name: "İşletmemi oluştur" }).click();
  await expect(page.getByRole("heading", { name: /Test 👋/ })).toBeVisible();
  await expect(page.getByText("İlk siparişini oluşturalım")).toBeVisible();
  await page.getByRole("link", { name: "Ürünler & menü" }).click();
  await page.getByRole("button", { name: "Ürün ekle" }).first().click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Ürün adı").fill("Test Mega Dürüm");
  await dialog.getByLabel("Satış fiyatı").fill("120");
  await dialog.getByLabel("Birim maliyet").fill("45");
  await dialog.getByLabel("Başlangıç stoku").fill("20");
  await dialog.getByLabel("Minimum stok").fill("5");
  await dialog.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Test Mega Dürüm" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Siparişler" }).click();
  await page.getByRole("button", { name: "Yeni sipariş" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /Test Mega Dürüm.*stokta/ }).click();
  await dialog.getByRole("button", { name: "Test Mega Dürüm artır" }).click();
  await dialog.getByLabel("Müşteri / masa").fill("Masa 3");
  await dialog.getByRole("button", { name: "Siparişi oluştur" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Hazırlanıyor", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Sipariş 1001 ayrıntıları/ }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByText("2 × Test Mega Dürüm")).toBeVisible();
  await dialog.getByRole("button", { name: "Hazır olarak işaretle" }).click();
  await expect(dialog.getByText("Hazır", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Teslim et ve tamamla" }).click();
  await expect(dialog.getByText("Tamamlandı", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
  await page.getByRole("link", { name: "Stok yönetimi" }).click();
  const stockRow = page
    .getByRole("row")
    .filter({ has: page.getByText("Test Mega Dürüm", { exact: true }) })
    .first();
  await expect(stockRow).toContainText("18");
  await stockRow.getByRole("button", { name: "Hareket ekle" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Miktar", { exact: true }).fill("5");
  await dialog
    .getByLabel("Açıklama", { exact: true })
    .fill("Tedarik teslimatı");
  await dialog.getByRole("button", { name: "Hareketi kaydet" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(stockRow).toContainText("23");
  await page.getByRole("link", { name: "Giderler" }).click();
  await page.getByRole("button", { name: "Gider ekle" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Gider açıklaması").fill("Elektrik faturası");
  await dialog.getByLabel("Tutar").fill("750.50");
  await dialog.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "Elektrik faturası", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Personel", exact: true }).click();
  await page.getByRole("button", { name: "Personel ekle" }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Ad soyad").fill("Test Çalışanı");
  await dialog.getByLabel("Görev", { exact: true }).fill("Kasiyer");
  await dialog.getByLabel("Aylık maaş").fill("28000");
  await dialog.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Test Çalışanı" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Raporlar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "İşletme raporları" }),
  ).toBeVisible();
  await expect(
    page.locator(".stat-card").filter({ hasText: "Toplam ciro" }),
  ).toContainText("240,00");
  await expect(
    page.locator(".stat-card").filter({ hasText: "Brüt ürün kârı" }),
  ).toContainText("150,00");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Satışları CSV indir" }).click();
  expect((await download).suggestedFilename()).toMatch(/komagene-satis.*csv/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "İşletme raporları" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Güvenli çıkış" }).click();
  await expect(
    page.getByRole("heading", { name: "Tekrar hoş geldin." }),
  ).toBeVisible();
  await page.getByLabel("Yönetici şifresi", { exact: true }).fill(testPassword);
  await page.getByRole("button", { name: "Panele giriş yap" }).click();
  await expect(
    page.getByRole("heading", { name: "İşletme raporları" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [link, title] of [
    ["Genel bakış", /Test 👋/],
    ["Ürünler & menü", "Ürünler & menü"],
    ["Stok yönetimi", "Stok yönetimi"],
    ["Giderler", "Giderler"],
    ["Personel", "Personel"],
    ["Raporlar", "İşletme raporları"],
    ["Ayarlar", "İşletme ayarları"],
    ["Siparişler", "Siparişler"],
  ] as const) {
    await page.getByRole("button", { name: "Menüyü aç" }).click();
    await page.getByRole("link", { name: link, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: title, level: 1 }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Yeni sipariş" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /Test Mega Dürüm.*stokta/ }).click();
  await dialog.getByRole("button", { name: "Siparişi oluştur" }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Sipariş 1002 ayrıntıları" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Siparişi iptal et" }).click();
  await expect(dialog.getByText(/ürünler stoğa geri eklenecek/)).toBeVisible();
  await dialog.getByRole("button", { name: "Evet, iptal et" }).click();
  await expect(dialog.getByText("İptal", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  expect(errors).toEqual([]);
});
