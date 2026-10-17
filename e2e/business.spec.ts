import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
const password = randomBytes(18).toString("hex");
test("gelir-gider paneli: kayıt, rapor, yedekleme ve mobil kullanım", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Hesabını birlikte açalım." }),
  ).toBeVisible();
  await page.getByLabel("Adın soyadın").fill("Ahmet Test");
  await page
    .getByLabel("İşletme / şube adı", { exact: true })
    .fill("Komagene Finans");
  await page.getByLabel("Yönetici şifresi", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Panelimi oluştur" }).click();
  await expect(
    page.getByRole("heading", { name: "Merhaba, Ahmet 👋" }),
  ).toBeVisible();
  const now = new Date();
  const y = Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
    }).format(now),
  );
  const m = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    month: "2-digit",
  }).format(now);
  async function add(
    type: "Gelir" | "Gider",
    amount: string,
    description: string,
    date: string,
    pending = false,
  ) {
    await page
      .getByRole("button", { name: type + " ekle", exact: true })
      .first()
      .click();
    const d = page.getByRole("dialog");
    await d.getByLabel("Tutar (₺)").fill(amount);
    await d.getByLabel("Açıklama", { exact: true }).fill(description);
    await d.getByLabel("İşlem / vade tarihi").fill(date);
    if (pending)
      await d.getByRole("combobox", { name: "Durum", exact: true }).selectOption("pending");
    await d.getByRole("button", { name: "Kaydı oluştur" }).click();
    await expect(d).not.toBeVisible();
    await expect(page.locator(".report-loading")).not.toBeVisible();
  }
  await add("Gelir", "1200.50", "Günlük satış", `${y}-${m}-10`);
  await add("Gider", "400.25", "Malzeme gideri", `${y}-${m}-11`);
  await add("Gelir", "500", "Bekleyen tahsilat", `${y}-${m}-20`, true);
  await expect(
    page.locator(".metric").filter({ hasText: "Toplam gelir" }),
  ).toContainText("1.200,50");
  await expect(
    page.locator(".metric").filter({ hasText: "Toplam gider" }),
  ).toContainText("400,25");
  await expect(
    page.locator(".metric").filter({ hasText: "Net fark" }),
  ).toContainText("800,25");
  await add("Gelir", "900", "Geçen yıl geliri", `${y - 1}-12-31`);
  await page.getByRole("link", { name: "Tüm hareketler", exact: true }).click();
  await page.getByLabel("Açıklama, kişi veya belge ara…").fill("Bekleyen");
  await expect(
    page.getByRole("row").filter({ hasText: "Bekleyen tahsilat" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Bekleyen tahsilat düzenle" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Durum", exact: true }).selectOption("paid");
  await dialog.getByRole("button", { name: "Değişiklikleri kaydet" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Tahsil edildi", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Temizle", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV indir", exact: true }).click();
  expect((await download).suggestedFilename()).toContain(".csv");
  await page.getByRole("link", { name: "Raporlar", exact: true }).click();
  await page.getByRole("button", { name: "Yıllık", exact: true }).click();
  await expect(
    page.locator(".metric").filter({ hasText: "Toplam gelir" }),
  ).toContainText("1.700,50");
  await expect(
    page.getByRole("heading", { name: "Yıllara göre karşılaştırma" }),
  ).toBeVisible();
  await expect(
    page.getByText(String(y - 1), { exact: true }).last(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Özel aralık", exact: true }).click();
  await page
    .getByLabel("Başlangıç tarihi", { exact: true })
    .fill(`${y - 1}-12-31`);
  await page.getByLabel("Bitiş tarihi", { exact: true }).fill(`${y - 1}-12-31`);
  await expect(
    page.locator(".metric").filter({ hasText: "Toplam gelir" }),
  ).toContainText("900,00");
  await page.getByRole("button", { name: "Tüm zamanlar", exact: true }).click();
  await expect(
    page.locator(".metric").filter({ hasText: "Toplam gelir" }),
  ).toContainText("2.600,50");
  await page.getByRole("link", { name: "Kategoriler", exact: true }).click();
  await page
    .getByRole("button", { name: "Kategori ekle", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Kategori adı").fill("Test masrafı");
  await dialog.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("Test masrafı", { exact: true })).toBeVisible();
  await page
    .getByRole("link", { name: "Ayarlar & yedekleme", exact: true })
    .click();
  const fileDownload = page.waitForEvent("download");
  await page.getByRole("link", { name: "Tüm verileri yedekle" }).click();
  const backup = await fileDownload;
  const path = await backup.path();
  expect(path).toBeTruthy();
  await page.getByLabel("JSON yedek dosyası seç").setInputFiles(path!);
  await expect(
    page.getByText(/0 yeni kayıt.*4 zaten mevcut kayıt/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Onayla ve geri yükle" }).click();
  await expect(page.locator(".import-preview")).not.toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Ayarlar & yedekleme" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [link, title] of [
    ["Genel bakış", "Merhaba, Ahmet 👋"],
    ["Gelirler", "Gelirler"],
    ["Giderler", "Giderler"],
    ["Tüm hareketler", "Tüm hareketler"],
    ["Raporlar", "Finansal raporlar"],
    ["Kategoriler", "Kategoriler"],
    ["Ayarlar & yedekleme", "Ayarlar & yedekleme"],
  ]) {
    await page.getByRole("button", { name: "Menüyü aç" }).click();
    await page.getByRole("link", { name: link, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: title, level: 1 }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Menüyü aç" }).click();
  await page.getByRole("button", { name: "Güvenli çıkış" }).click();
  await expect(
    page.getByRole("heading", { name: "Tekrar hoş geldin." }),
  ).toBeVisible();
  await page.getByLabel("Yönetici şifresi", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ayarlar & yedekleme" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
