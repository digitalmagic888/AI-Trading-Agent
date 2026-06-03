import { createAgentServer } from "./api/server";

const port = Number(process.env.PORT ?? 3001);
createAgentServer().listen(port, () => {
  console.log(`TriStack Alpha Agent API listening on http://localhost:${port}`);
});
