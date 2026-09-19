import "dotenv/config";
import { createApp } from "./api/server";

const PORT = Number(process.env.PORT) || 4000;

const { httpServer } = createApp();

httpServer.listen(PORT, () => {
  console.log(`Jidoka backend listening on http://localhost:${PORT}`);
});
