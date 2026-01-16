import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type ChromaprintFingerprint = {
  duration: number;
  fingerprint: string;
  fpcalcPath: string;
};

export async function getChromaprintFingerprint(
  audioPath: string,
  opts?: { timeoutMs?: number }
): Promise<ChromaprintFingerprint> {
  const timeoutMs = opts?.timeoutMs ?? 20_000;
  const fpcalcPath = await resolveFpcalcPath();
  const { stdout } = await execFileAsync(fpcalcPath, ["-json", audioPath], { timeout: timeoutMs, maxBuffer: 2 * 1024 * 1024 });
  const json = JSON.parse(String(stdout)) as { duration?: number; fingerprint?: string };
  if (!json?.duration || !json?.fingerprint) throw new Error("fpcalc returned invalid output.");
  return { duration: json.duration, fingerprint: json.fingerprint, fpcalcPath };
}

async function resolveFpcalcPath(): Promise<string> {
  const fromEnv = process.env.DROPCRATE_FPCALC_PATH?.trim();
  if (fromEnv) return fromEnv;
  // Assume fpcalc is available on PATH if installed.
  return "fpcalc";
}

