import { loadDotEnv, updateDotEnv } from "./env";

loadDotEnv();
updateDotEnv({
  ALLOW_LIVE_FLASH_SUBMIT: "false",
  ALLOW_LIVE_FLASH_ONESHOT: "false",
  BROADCAST_ROUTE_HASH: "",
  LAST_BROADCAST_DISABLED_AT: new Date().toISOString(),
  LAST_BROADCAST_DISABLED_REASON: "manual_disable_command"
});
console.log(JSON.stringify({ ok: true, broadcast: "disabled" }, null, 2));
