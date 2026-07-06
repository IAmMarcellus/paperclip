import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "../types.js";
import { asString, parseObject } from "../utils.js";
import { DEFAULT_OPENSAGE_BASE_URL } from "./constants.js";

function summarizeStatus(
  checks: AdapterEnvironmentCheck[],
): AdapterEnvironmentTestResult["status"] {
  if (checks.some((c) => c.level === "error")) return "fail";
  if (checks.some((c) => c.level === "warn")) return "warn";
  return "pass";
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const baseUrlRaw = asString(config.baseUrl, DEFAULT_OPENSAGE_BASE_URL);
  const configuredApp = asString(config.appName, "");

  let baseUrl: URL | null = null;
  try {
    baseUrl = new URL(baseUrlRaw);
  } catch {
    checks.push({
      code: "opensage_base_url_invalid",
      level: "error",
      message: `Invalid OpenSage base URL: ${baseUrlRaw}`,
      hint: "Set baseUrl to the opensage web server, e.g. http://localhost:8800.",
    });
  }

  if (baseUrl) {
    checks.push({
      code: "opensage_base_url",
      level: "info",
      message: `OpenSage base URL: ${baseUrl.toString()}`,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(new URL("/list-apps", baseUrl), { signal: controller.signal });
      if (res.ok) {
        const apps = (await res.json()) as unknown;
        const list = Array.isArray(apps) ? apps.map((a) => String(a)) : [];
        if (list.length === 0) {
          checks.push({
            code: "opensage_no_apps",
            level: "warn",
            message: "OpenSage is reachable but is not serving any app.",
            hint: "Start it with `make opensage`.",
          });
        } else if (configuredApp) {
          if (list.includes(configuredApp)) {
            checks.push({
              code: "opensage_app_found",
              level: "info",
              message: `OpenSage is reachable and serving app "${configuredApp}".`,
            });
          } else {
            checks.push({
              code: "opensage_app_missing",
              level: "warn",
              message: `OpenSage is reachable but did not list app "${configuredApp}".`,
              detail: `Available apps: ${list.join(", ")}`,
              hint: "Leave App name blank to auto-detect, or set it to one of the available apps.",
            });
          }
        } else {
          checks.push({
            code: "opensage_app_discovered",
            level: "info",
            message: `OpenSage is reachable; auto-detecting app "${list[0]}".`,
            ...(list.length > 1 ? { detail: `Available apps: ${list.join(", ")}` } : {}),
          });
        }
      } else {
        checks.push({
          code: "opensage_probe_unexpected_status",
          level: "warn",
          message: `OpenSage probe returned HTTP ${res.status}.`,
          hint: "Verify the opensage web server is healthy.",
        });
      }
    } catch (err) {
      checks.push({
        code: "opensage_probe_failed",
        level: "error",
        message: err instanceof Error ? err.message : "OpenSage probe failed",
        hint: "Start it with `make opensage` (default :8800) before running this agent.",
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
