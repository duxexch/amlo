export type OutboxMessageType = "text" | "image" | "video" | "voice";

export type OutboxItem = {
    id: string;
    conversationId: string;
    type: OutboxMessageType;
    content?: string;
    clientMessageId?: string;
    replyToId?: string | null;
    blob?: Blob;
    filename?: string;
    createdAt: string;
    attempts: number;
    status: "pending" | "failed";
    lastError?: string;
};

const DB_NAME = "ablox-chat-outbox";
const DB_VERSION = 1;
const STORE_NAME = "messages";

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === "undefined") {
            reject(new Error("IndexedDB is unavailable"));
            return;
        }

        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
                store.createIndex("conversationId", "conversationId", { unique: false });
                store.createIndex("createdAt", "createdAt", { unique: false });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error("Failed to open outbox DB"));
    });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => Promise<T> | T): Promise<T> {
    const db = await openDb();
    return new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);

        Promise.resolve(run(store))
            .then((result) => {
                tx.oncomplete = () => {
                    db.close();
                    resolve(result);
                };
                tx.onerror = () => {
                    db.close();
                    reject(tx.error || new Error("Outbox transaction failed"));
                };
            })
            .catch((err) => {
                db.close();
                reject(err);
            });
    });
}

function requestToPromise<T = any>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
    });
}

export async function outboxUpsert(item: OutboxItem): Promise<void> {
    await withStore("readwrite", async (store) => {
        await requestToPromise(store.put(item));
    });
}

export async function outboxRemove(id: string): Promise<void> {
    await withStore("readwrite", async (store) => {
        await requestToPromise(store.delete(id));
    });
}

export async function outboxGet(id: string): Promise<OutboxItem | null> {
    return withStore("readonly", async (store) => {
        const item = await requestToPromise<OutboxItem | undefined>(store.get(id));
        return item || null;
    });
}

export async function outboxListByConversation(conversationId: string): Promise<OutboxItem[]> {
    return withStore("readonly", async (store) => {
        const idx = store.index("conversationId");
        const rows = await requestToPromise<OutboxItem[]>(idx.getAll(IDBKeyRange.only(conversationId)));
        return (rows || []).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });
}

export async function outboxMarkFailed(id: string, errorMessage?: string): Promise<void> {
    const current = await outboxGet(id);
    if (!current) return;

    await outboxUpsert({
        ...current,
        attempts: (current.attempts || 0) + 1,
        status: "failed",
        ...(errorMessage ? { lastError: errorMessage.slice(0, 250) } : {}),
    });
}

export async function outboxMarkPending(id: string): Promise<void> {
    const current = await outboxGet(id);
    if (!current) return;
    await outboxUpsert({
        ...current,
        status: "pending",
    });
}
