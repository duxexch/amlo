/**
 * Aplo — Structured Logger (Pino)
 * Production: JSON logs (machine-parseable, Grafana/ELK-ready)
 * Development: Pretty-printed colored output
 */
import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
  ...(isProduction
    ? {
        // Production: JSON output, no pretty printing
        formatters: {
          level(label: string) {
            return { level: label };
          },
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }
    : {
        // Development: pretty print
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss",
            ignore: "pid,hostname",
          },
        },
      }),
});

/**
 * Create a child logger with a source tag.
 */
export function createLogger(source: string) {
  return logger.child({ source });
}
