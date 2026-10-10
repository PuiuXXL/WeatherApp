import { readFile } from "node:fs/promises";

const assets = new Map([
  ["/local-weather", ["./page.html", "text/html; charset=utf-8"]],
  ["/local-weather/location.js", ["./location.js", "text/javascript; charset=utf-8"]],
]);

export async function handleCurrentLocation(requestUrl, response) {
  const asset = assets.get(requestUrl.pathname);
  if (!asset) return false;

  const body = await readFile(new URL(asset[0], import.meta.url));
  response.writeHead(200, {
    "Content-Type": asset[1],
    "Cache-Control": "no-store",
    "Permissions-Policy": "geolocation=(self)",
  });
  response.end(body);
  return true;
}
