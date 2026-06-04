import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "../paths";
import { loadDotEnv, updateDotEnv } from "./env";
import { runExecutionWorkerOnce } from "./executionWorker";

function latestRouteHash(): string {
  const artifactPath = path.join(repoRoot, "artifacts", "live-execution-worker-latest.json");
  if (!fs.existsSync(artifactPath)) throw new Error("No worker artifact found. Run agent:worker:once first.");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as { simulation?: { passed?: boolean }; route?: { routeHash?: string } };
  if (!artifact.simulation?.passed || !artifact.route?.routeHash) throw new Error("Latest worker artifact does not show a passing simulation route.");
  return artifact.route.routeHash;
}

loadDotEnv();
const routeHash = process.env.BROADCAST_ROUTE_HASH || latestRouteHash();
updateDotEnv({
  ALLOW_LIVE_FLASH_SUBMIT: "true",
  ALLOW_LIVE_FLASH_ONESHOT: "true",
  BROADCAST_ROUTE_HASH: routeHash,
  LAST_BROADCAST_ARMED_AT: new Date().toISOString()
});

try {
  const result = await runExecutionWorkerOnce();
  console.log(JSON.stringify(result, null, 2));
} finally {
  updateDotEnv({
    ALLOW_LIVE_FLASH_SUBMIT: "false",
    ALLOW_LIVE_FLASH_ONESHOT: "false",
    BROADCAST_ROUTE_HASH: "",
    LAST_BROADCAST_DISABLED_AT: new Date().toISOString(),
    LAST_BROADCAST_DISABLED_REASON: "one_shot_command_completed"
  });
}
