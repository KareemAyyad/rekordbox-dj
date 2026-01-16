import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import https from "node:https";
import { createWriteStream } from "node:fs";
import YTDlpWrapImport from "yt-dlp-wrap";
import { withTimeout, safeRemove } from "../util/async.js";

const execFileAsync = promisify(execFile);
let ytDlpBinaryPathOnce: Promise<string> | null = null;

type YtDlpExec = { execPromise(args?: string[]): Promise<string> };

export function getYtDlpCookieArgs(): string[] {
  const args: string[] = [];
  const cookiesFromBrowser = process.env.DROPCRATE_COOKIES_FROM_BROWSER?.trim();
  const cookiesFile = process.env.DROPCRATE_YTDLP_COOKIES?.trim();
  if (cookiesFromBrowser) args.push("--cookies-from-browser", cookiesFromBrowser);
  else if (cookiesFile) args.push("--cookies", cookiesFile);
  return args;
}

export async function createYtDlp(): Promise<{ ytdlp: YtDlpExec; binaryPath: string }> {
  const YTDlpWrapCtor = getYtDlpWrapCtor();
  const binaryPath = await ensureYtDlpBinaryPath(YTDlpWrapCtor);
  const ytdlp = new YTDlpWrapCtor(binaryPath === "yt-dlp" ? undefined : binaryPath) as unknown as YtDlpExec;
  // Some yt-dlp-wrap versions emit an 'error' event; avoid process crashes when no listener is present.
  const maybeEmitter = ytdlp as unknown as { on?: (evt: string, fn: (...args: any[]) => void) => void };
  if (typeof maybeEmitter.on === "function") maybeEmitter.on("error", () => {});
  return { ytdlp, binaryPath };
}

export async function getVideoInfo(url: string, opts?: { timeoutMs?: number }): Promise<any> {
  const timeoutMs = opts?.timeoutMs ?? 60_000;
  console.log(`[ytdlp] getVideoInfo: ${url} (timeout=${timeoutMs}ms)`);
  const args = [
    url,
    "--dump-single-json",
    "--no-warnings",
    "--no-playlist",
    "--socket-timeout",
    "10",
    "--retries",
    "1",
    "--extractor-retries",
    "1",
    ...getYtDlpCookieArgs()
  ];

  const infoRaw = await withTimeout(
    (async () => {
      const { ytdlp } = await createYtDlp();
      return await ytdlp.execPromise(args);
    })(),
    timeoutMs,
    `yt-dlp info timed out after ${timeoutMs}ms`
  );

  return JSON.parse(infoRaw);
}


function getYtDlpWrapCtor(): new (binaryPath?: string) => { execPromise(args?: string[]): Promise<string> } {
  const maybeDefault = (YTDlpWrapImport as unknown as { default?: unknown }).default;
  const ctor = (maybeDefault ?? YTDlpWrapImport) as unknown;
  return ctor as new (binaryPath?: string) => { execPromise(args?: string[]): Promise<string> };
}

async function ensureYtDlpBinaryPath(
  YTDlpWrapCtor: new (binaryPath?: string) => { execPromise(args?: string[]): Promise<string> }
): Promise<string> {
  if (process.env.DROPCRATE_YTDLP_PATH?.trim()) return process.env.DROPCRATE_YTDLP_PATH.trim();

  if (!ytDlpBinaryPathOnce) {
    ytDlpBinaryPathOnce = (async () => {
      // Prefer a system yt-dlp if present.
      try {
        await execFileAsync("yt-dlp", ["--version"]);
        return "yt-dlp";
      } catch {
        // ignore
      }

      const filename = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
      const binDir = path.join(process.cwd(), ".dropcrate", "bin");
      const binPath = path.join(binDir, filename);
      const zipappPath = process.platform === "win32" ? null : path.join(binDir, "yt-dlp.pyz");

      await fs.mkdir(binDir, { recursive: true });

      if (await isExecutableYtDlp(binPath)) return binPath;

      // Try standalone binary from GitHub.
      await safeRemove(binPath);
      const assetUrl = await getLatestYtDlpAssetUrl({ kind: "standalone" });
      await downloadToFile(assetUrl, binPath);
      if (process.platform !== "win32") await fs.chmod(binPath, 0o755);
      if (await isExecutableYtDlp(binPath)) return binPath;

      // Fallback: zipapp + python3.10+
      if (process.platform === "win32") throw new Error("Downloaded yt-dlp.exe but it did not run successfully.");

      const python = await findPython310Plus();
      if (!python) {
        throw new Error("Downloaded yt-dlp but it did not run; and no python3.10+ was found for zipapp fallback.");
      }

      await safeRemove(binPath);
      if (zipappPath) {
        await safeRemove(zipappPath);
        const zipappUrl = await getLatestYtDlpAssetUrl({ kind: "zipapp" });
        await downloadToFile(zipappUrl, zipappPath);
      }

      const wrapper = buildYtDlpWrapperScript(python, zipappPath!);
      await fs.writeFile(binPath, wrapper, "utf8");
      await fs.chmod(binPath, 0o755);
      if (!(await isExecutableYtDlp(binPath))) throw new Error("Zipapp fallback yt-dlp did not run successfully.");
      return binPath;
    })();
  }

  return ytDlpBinaryPathOnce;
}

async function isExecutableYtDlp(binaryPath: string): Promise<boolean> {
  try {
    await fs.access(binaryPath);
  } catch {
    return false;
  }
  try {
    await execFileAsync(binaryPath, ["--version"]);
    return true;
  } catch {
    return false;
  }
}


type GithubRelease = {
  assets?: Array<{ name?: string; browser_download_url?: string }>;
};

async function getLatestYtDlpAssetUrl(opts: { kind: "standalone" | "zipapp" }): Promise<string> {
  const release = await fetchJson<GithubRelease>("https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest");
  const assets = release.assets ?? [];

  const desiredName = pickYtDlpAssetName(opts);
  const match = assets.find((a) => a.name === desiredName)?.browser_download_url;
  if (match) return match;

  for (const name of pickYtDlpFallbackNames(opts)) {
    const url = assets.find((a) => a.name === name)?.browser_download_url;
    if (url) return url;
  }

  throw new Error(`Could not find a suitable yt-dlp asset in latest release (wanted ${desiredName}).`);
}

function pickYtDlpAssetName(opts: { kind: "standalone" | "zipapp" }): string {
  if (opts.kind === "zipapp") return "yt-dlp";
  if (process.platform === "win32") return "yt-dlp.exe";
  if (process.platform === "darwin") return "yt-dlp_macos";
  if (process.platform === "linux") {
    if (process.arch === "arm64") return "yt-dlp_linux_aarch64";
    if (process.arch === "arm") return "yt-dlp_linux_armv7l";
    return "yt-dlp_linux";
  }
  return "yt-dlp";
}

function pickYtDlpFallbackNames(opts: { kind: "standalone" | "zipapp" }): string[] {
  if (opts.kind === "zipapp") return ["yt-dlp"];
  if (process.platform === "darwin") return ["yt-dlp_macos_legacy", "yt-dlp"];
  if (process.platform === "linux") return ["yt-dlp_linux", "yt-dlp"];
  if (process.platform === "win32") return ["yt-dlp.exe"];
  return ["yt-dlp"];
}

async function fetchJson<T>(url: string): Promise<T> {
  const body = await httpsGet(url, {
    "User-Agent": "dropcrate/0.1.0",
    Accept: "application/vnd.github+json"
  });
  return JSON.parse(body) as T;
}

async function downloadToFile(url: string, destPath: string): Promise<void> {
  const tmp = `${destPath}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  await safeRemove(tmp);

  await new Promise<void>((resolve, reject) => {
    const request = https.request(
      url,
      {
        headers: {
          "User-Agent": "dropcrate/0.1.0",
          Accept: "application/octet-stream"
        }
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location;
        if ([301, 302, 303, 307, 308].includes(status) && location) {
          res.resume();
          downloadToFile(location, destPath).then(resolve, reject);
          return;
        }
        if (status < 200 || status >= 300) {
          reject(new Error(`Download failed (${status}) for ${url}`));
          res.resume();
          return;
        }
        const out = createWriteStream(tmp);
        res.pipe(out);
        out.on("finish", () => resolve());
        out.on("error", reject);
      }
    );
    request.on("error", reject);
    request.end();
  });

  try {
    await fs.rename(tmp, destPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException | undefined)?.code === "ENOENT") return;
    throw err;
  }
}

async function httpsGet(url: string, headers: Record<string, string>): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const request = https.request(
      url,
      { headers },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location;
        if ([301, 302, 303, 307, 308].includes(status) && location) {
          res.resume();
          httpsGet(location, headers).then(resolve, reject);
          return;
        }
        if (status < 200 || status >= 300) {
          reject(new Error(`HTTP ${status} for ${url}`));
          res.resume();
          return;
        }
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      }
    );
    request.on("error", reject);
    request.end();
  });
}

async function findPython310Plus(): Promise<string | null> {
  const candidates = ["python3.12", "python3.11", "python3.10", "python3"];
  for (const cmd of candidates) {
    try {
      const { stdout } = await execFileAsync(cmd, ["-c", "import sys; print(f'{sys.version_info[0]}.{sys.version_info[1]}')"]);
      const [majorStr, minorStr] = String(stdout).trim().split(".");
      const major = Number(majorStr);
      const minor = Number(minorStr);
      if (major > 3 || (major === 3 && minor >= 10)) return cmd;
    } catch {
      // ignore
    }
  }
  return null;
}

function buildYtDlpWrapperScript(pythonCmd: string, zipappPath: string): string {
  return `#!/bin/sh
set -e
exec ${shellEscape(pythonCmd)} ${shellEscape(zipappPath)} "$@"
`;
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

/**
 * Parse yt-dlp error messages and return user-friendly descriptions.
 */
export function parseYtDlpError(error: unknown): { message: string; hint?: string; retryable: boolean } {
  const msg = String((error as { message?: string })?.message ?? error).toLowerCase();
  const stderr = String((error as { stderr?: string })?.stderr ?? "").toLowerCase();
  const text = `${msg}\n${stderr}`;

  // Rate limiting
  if (text.includes("429") || text.includes("too many requests") || text.includes("rate limit")) {
    return {
      message: "YouTube rate limit hit",
      hint: "Wait a few minutes and try again, or use cookies for authentication",
      retryable: true
    };
  }

  // Geo-block
  if (text.includes("not available in your country") || text.includes("geo") || text.includes("blocked")) {
    return {
      message: "Video is geo-restricted",
      hint: "This video is not available in your region. Try using a VPN",
      retryable: false
    };
  }

  // Age restriction
  if (text.includes("age") && (text.includes("restricted") || text.includes("gate"))) {
    return {
      message: "Video is age-restricted",
      hint: "Set DROPCRATE_COOKIES_FROM_BROWSER=chrome to use your YouTube login",
      retryable: false
    };
  }

  // Private video
  if (text.includes("private video") || text.includes("video is private")) {
    return {
      message: "Video is private",
      hint: "This video is private and cannot be downloaded",
      retryable: false
    };
  }

  // Video unavailable
  if (text.includes("video unavailable") || text.includes("this video has been removed") || text.includes("deleted")) {
    return {
      message: "Video unavailable",
      hint: "The video may have been deleted or made unavailable by the uploader",
      retryable: false
    };
  }

  // Login required
  if (text.includes("sign in") || text.includes("login") || text.includes("members only")) {
    return {
      message: "Login required",
      hint: "Set DROPCRATE_COOKIES_FROM_BROWSER=chrome to use your YouTube login",
      retryable: false
    };
  }

  // Copyright claim
  if (text.includes("copyright") || text.includes("claimed") || text.includes("takedown")) {
    return {
      message: "Video blocked due to copyright",
      hint: "This video has been blocked due to a copyright claim",
      retryable: false
    };
  }

  // Network errors
  if (text.includes("network") || text.includes("connection") || text.includes("timeout") || text.includes("timed out")) {
    return {
      message: "Network error",
      hint: "Check your internet connection and try again",
      retryable: true
    };
  }

  // Invalid URL
  if (text.includes("unsupported url") || text.includes("no video formats") || text.includes("unable to extract")) {
    return {
      message: "Invalid or unsupported URL",
      hint: "Make sure the URL is a valid YouTube video link",
      retryable: false
    };
  }

  // Fallback
  return {
    message: "Download failed",
    hint: undefined,
    retryable: false
  };
}
