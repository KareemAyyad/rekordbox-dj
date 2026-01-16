#!/usr/bin/env node
import process from "node:process";

const key = process.env.DROPCRATE_ACOUSTID_KEY?.trim();
if (!key) {
  console.error("Missing DROPCRATE_ACOUSTID_KEY (set it in .env).");
  process.exit(1);
}

// Minimal request to validate the key without needing audio/fpcalc.
const body = new URLSearchParams();
body.set("client", key);
body.set("meta", "recordings");
body.set("duration", "1");
body.set("fingerprint", "0");

const res = await fetch("https://api.acoustid.org/v2/lookup", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body
});

const text = await res.text();
if (res.ok) {
  console.log("AcoustID key looks valid (lookup endpoint accepted the request).");
  process.exit(0);
}

// If the key is invalid, AcoustID responds with code=4.
console.error(`AcoustID lookup failed (HTTP ${res.status}).`);
console.error(text.slice(0, 400));
process.exit(1);

