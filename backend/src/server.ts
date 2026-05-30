import { app } from "./app";
import { env } from "./config/env";
import { prisma } from "./config/prisma";
import { purgeOrphanClinics } from "./utils/clinic-cleanup";

const startServer = async () => {
  await prisma.$connect();
  try {
    const { purged } = await purgeOrphanClinics();
    if (purged.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`Purged ${purged.length} orphan clinic shell(s) on startup`);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("Orphan clinic purge on startup failed (non-fatal)", error);
  }
  app.listen(env.PORT, () => {
    // Keep startup logs small and actionable for local debugging.
    // eslint-disable-next-line no-console
    console.log(`Backend running at http://localhost:${env.PORT}`);
  });
};

startServer().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server", error);
  process.exit(1);
});
