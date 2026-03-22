import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const webRoot = process.cwd();
const emailRoot = path.join(webRoot, "email-intelligence");
const phoneRoot = path.join(webRoot, "phone-intelligence");
const viteBin = path.join(webRoot, "node_modules", ".bin", "vite");
const pythonBin = path.join(emailRoot, ".venv", "bin", "python");
const phonePythonBin = path.join(phoneRoot, ".venv", "bin", "python");
const healthUrl = process.env.EMAIL_INTEL_HEALTH_URL ?? "http://127.0.0.1:8000/health";
const emailIntelUrl = process.env.VITE_EMAIL_INTEL_URL ?? "http://localhost:8000";
const phoneHealthUrl = process.env.PHONE_INTEL_HEALTH_URL ?? "http://127.0.0.1:8001/health";
const phoneIntelUrl = process.env.VITE_PHONE_INTEL_URL ?? "http://localhost:8001";

const children = new Set();
let shuttingDown = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function spawnService(name, command, args, cwd, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...extraEnv },
    stdio: "inherit",
  });

  children.add(child);

  child.on("error", (error) => {
    if (shuttingDown) return;
    console.error(`[${name}] failed to start: ${error.message}`);
    shutdown(1);
  });

  child.on("exit", (code, signal) => {
    children.delete(child);
    if (shuttingDown) return;

    const exitCode = code ?? (signal ? 1 : 0);
    console.error(`[${name}] exited unexpectedly${signal ? ` via ${signal}` : ` with code ${exitCode}`}.`);
    shutdown(exitCode || 1);
  });

  return child;
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    try {
      child.kill("SIGTERM");
    } catch {
      // Best effort only.
    }
  }

  setTimeout(() => {
    for (const child of children) {
      try {
        child.kill("SIGKILL");
      } catch {
        // Best effort only.
      }
    }
    process.exit(code);
  }, 3000).unref();
}

async function waitForHealth(url, timeoutMs = 180000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) {
        return;
      }
    } catch {
      // Keep waiting until the service is ready.
    }
    await sleep(1000);
  }

  throw new Error(`Timed out waiting for service at ${url}`);
}

async function main() {
  if (!existsSync(viteBin)) {
    throw new Error(`Could not find Vite binary at ${viteBin}`);
  }

  if (!existsSync(pythonBin)) {
    throw new Error(`Could not find the email-intelligence virtualenv Python at ${pythonBin}`);
  }

  console.log("[dev] starting email-intelligence backend...");
  console.log(`[dev] waiting for ${healthUrl}...`);

  const emailService = spawnService(
    "email-intelligence",
    pythonBin,
    ["-m", "uvicorn", "src.api:app", "--port", "8000"],
    emailRoot,
  );

  try {
    await waitForHealth(healthUrl);
  } catch (error) {
    console.error(`[dev] ${error instanceof Error ? error.message : "email intelligence did not become ready"}`);
    shutdown(1);
    return;
  }

  if (shuttingDown) {
    emailService.kill("SIGTERM");
    return;
  }

  console.log("[dev] email-intelligence is ready");

  if (existsSync(phonePythonBin)) {
    console.log("[dev] starting phone-intelligence backend...");
    console.log(`[dev] waiting for ${phoneHealthUrl}...`);

    spawnService(
      "phone-intelligence",
      phonePythonBin,
      ["-m", "uvicorn", "src.api:app", "--port", "8001"],
      phoneRoot,
    );

    try {
      await waitForHealth(phoneHealthUrl);
      console.log("[dev] phone-intelligence is ready");
    } catch (error) {
      console.warn(`[dev] ${error instanceof Error ? error.message : "phone intelligence did not become ready"}`);
    }
  } else {
    console.log("[dev] phone-intelligence virtualenv not found; skipping phone backend startup");
  }

  console.log("[dev] starting web app...");

  spawnService(
    "vite",
    viteBin,
    ["--host"],
    webRoot,
    {
      VITE_EMAIL_INTEL_URL: emailIntelUrl,
      VITE_PHONE_INTEL_URL: phoneIntelUrl,
    },
  );
}

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(143));

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  shutdown(1);
});
