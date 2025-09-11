export function createNamespacedDebug(
  namespace: string
): (formatter: unknown, ...args: unknown[]) => void
export function logError(message: string, error?: Error): void
