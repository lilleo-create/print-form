import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { TtlCache } from "../utils/cache.js";

const SITEMAP_CACHE_KEY = "sitemap.xml";
const SITEMAP_CACHE_TTL_MS = 60 * 60 * 1000;
const sitemapCache = new TtlCache<string, string>(1);

const getBaseUrl = (hostHeader: string | undefined) => {
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL.replace(/\/+$/, "");
  }

  if (hostHeader) {
    return `https://${hostHeader}`;
  }

  return "https://print-form.ru";
};

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const buildUrlTag = (loc: string, lastmod?: Date | null, changefreq = "daily", priority = "0.7") => {
  const lastmodTag = lastmod ? `<lastmod>${lastmod.toISOString()}</lastmod>` : "";
  return `<url><loc>${escapeXml(loc)}</loc>${lastmodTag}<changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
};

export const seoRoutes = Router();

seoRoutes.get("/robots.txt", (_req, res) => {
  res.type("text/plain");
  res.send(["User-agent: *", "Allow: /", "Sitemap: https://print-form.ru/sitemap.xml"].join("\n"));
});

seoRoutes.get("/sitemap.xml", async (req, res, next) => {
  try {
    const cachedSitemap = sitemapCache.get(SITEMAP_CACHE_KEY);
    if (cachedSitemap) {
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.type("application/xml");
      return res.send(cachedSitemap);
    }

    const baseUrl = getBaseUrl(req.get("host"));
    const [categories, products, shops] = await Promise.all([
      prisma.referenceCategory.findMany({
        where: { isActive: true },
        select: { slug: true, updatedAt: true }
      }),
      prisma.product.findMany({
        where: { moderationStatus: "APPROVED" },
        select: { id: true, updatedAt: true }
      }),
      prisma.sellerProfile.findMany({
        select: { userId: true, updatedAt: true }
      })
    ]);

    const urls = [
      buildUrlTag(`${baseUrl}/`, new Date(), "daily", "1.0"),
      buildUrlTag(`${baseUrl}/categories`, new Date(), "daily", "0.8"),
      ...categories.map((category) =>
        buildUrlTag(
          `${baseUrl}/catalog?category=${encodeURIComponent(category.slug)}`,
          category.updatedAt,
          "weekly",
          "0.7"
        )
      ),
      ...products.map((product) => buildUrlTag(`${baseUrl}/product/${product.id}`, product.updatedAt, "weekly", "0.9")),
      ...shops.map((shop) => buildUrlTag(`${baseUrl}/shop/${shop.userId}`, shop.updatedAt, "weekly", "0.7"))
    ];

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`;

    sitemapCache.set(SITEMAP_CACHE_KEY, sitemap, SITEMAP_CACHE_TTL_MS);

    res.setHeader("Cache-Control", "public, max-age=3600");
    res.type("application/xml");
    return res.send(sitemap);
  } catch (error) {
    return next(error);
  }
});
