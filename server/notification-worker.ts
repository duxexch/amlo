import "dotenv/config";
import { createLogger } from "./logger";
import { initRedis } from "./redis";
import { startNotificationWorker } from "./services/notificationQueue";
import { initPushService } from "./services/pushNotification";

const workerLog = createLogger("notification-worker");

async function bootstrap() {
    workerLog.info("Starting notification worker...");

    await initRedis();
    initPushService();

    await startNotificationWorker();
}

bootstrap().catch((err: any) => {
    workerLog.error(`Notification worker crashed: ${err?.message || "unknown error"}`);
    process.exit(1);
});
