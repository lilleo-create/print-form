import type { Request, Response } from "express";
import prerender from "prerender-node";

const BOT_USER_AGENTS = [
  "googlebot",
  "bingbot",
  "yandexbot",
  "baiduspider",
  "duckduckbot",
  "slurp",
  "facebot",
  "facebookexternalhit",
  "twitterbot",
  "linkedinbot",
  "rogerbot",
  "embedly",
  "quora link preview",
  "showyoubot",
  "outbrain",
  "pinterest",
  "slackbot",
  "vkShare",
  "W3C_Validator",
  "whatsapp"
];

const SKIP_EXTENSIONS = [
  ".js",
  ".css",
  ".xml",
  ".less",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".pdf",
  ".doc",
  ".txt",
  ".ico",
  ".rss",
  ".zip",
  ".mp3",
  ".rar",
  ".exe",
  ".wmv",
  ".doc",
  ".avi",
  ".ppt",
  ".mpg",
  ".mpeg",
  ".tif",
  ".wav",
  ".mov",
  ".psd",
  ".ai",
  ".xls",
  ".mp4",
  ".m4a",
  ".swf",
  ".dat",
  ".dmg",
  ".iso",
  ".flv",
  ".m4v",
  ".torrent",
  ".woff",
  ".svg",
  ".ttf",
  ".webmanifest",
  ".webp"
];

export const buildPrerenderMiddleware = () => {
  const middleware = prerender
    .set("protocol", "https")
    .set("crawlerUserAgents", BOT_USER_AGENTS)
    .set("extensionsToIgnore", SKIP_EXTENSIONS)
    .set("whitelisted", ["/", "/catalog", "/categories", "/product", "/shop"])
    .set("blacklisted", ["/api", "/uploads"])
    .set("beforeRender", (req: Request, done: (result?: { cancelRender?: boolean }) => void) => {
      if (req.method !== "GET" || req.path.startsWith("/api/") || req.path.startsWith("/uploads/")) {
        return done({ cancelRender: true });
      }

      return done();
    })
    .set("afterRender", (_err: unknown, req: Request, res: Response, done: () => void) => {
      res.setHeader("Vary", "User-Agent");
      if (req.path.startsWith("/sitemap.xml")) {
        res.setHeader("Cache-Control", "public, max-age=3600");
      }
      done();
    });

  const prerenderServiceUrl = process.env.PRERENDER_SERVICE_URL;
  if (prerenderServiceUrl) {
    middleware.set("prerenderServiceUrl", prerenderServiceUrl);
  }

  const prerenderToken = process.env.PRERENDER_TOKEN;
  if (prerenderToken) {
    middleware.set("prerenderToken", prerenderToken);
  }

  return middleware;
};
