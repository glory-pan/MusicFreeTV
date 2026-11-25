import pluginManager from "./pluginManager";

/**
 * 「这首歌有 MV」的小标（列表里画绿色 MV）。
 *
 * 判断要走网络（网易云查 mvid / B 站快速匹配），所以这里做了三件事：
 *   1. 结果按「平台+id」缓存在内存里，同一行不会重复请求；
 *   2. 全局单队列、并发 1、每次间隔 500ms，避免一屏 20 行把慢网络打满；
 *   3. 结果变化用订阅通知行组件重渲染，行在拿到结果前不显示标，不占位。
 */

const CACHE_TTL = 30 * 60 * 1000;
const cache = new Map<string, { value: boolean; ts: number }>();
const inQueue = new Set<string>();
const queue: any[] = [];
const listeners = new Set<() => void>();

function keyOf(item: any) {
    return `${item?.platform ?? ""}|${item?.id ?? ""}`;
}

export function getMvBadge(item: any): boolean | undefined {
    const entry = cache.get(keyOf(item));
    if (!entry) {
        return undefined;
    }
    if (Date.now() - entry.ts > CACHE_TTL) {
        cache.delete(keyOf(item));
        return undefined;
    }
    return entry.value;
}

export function subscribeMvBadge(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function emit() {
    listeners.forEach(listener => listener());
}

let active = 0;
const MAX_ACTIVE = 2;

async function pump() {
    while (active < MAX_ACTIVE && queue.length) {
        const item = queue.shift()!;
        active += 1;
        checkOne(item)
            .catch(() => undefined)
            .then(() => {
                active -= 1;
                emit();
                setTimeout(pump, 120);
            });
        // 稍微错开两条并发请求
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

async function checkOne(item: any) {
    const key = keyOf(item);
    try {
        const plugin = pluginManager.getByMedia(item) as any;
        const fn = plugin?.methods?.hasMusicVideo;
        if (typeof fn === "function") {
            const result: any = await Promise.race([
                fn(item).then(
                    (value: any) => ({ ok: true, value: !!value }),
                    () => ({ ok: false, value: false }),
                ),
                new Promise(resolve =>
                    setTimeout(
                        () => resolve({ ok: false, value: false }),
                        20000,
                    ),
                ),
            ]);
            // 只有真正拿到答复才写缓存；超时 / 报错留空，下次进页面重试
            if (result?.ok) {
                cache.set(key, { value: !!result.value, ts: Date.now() });
            }
            return;
        }
        const fallback = plugin?.methods?.getMusicVideo;
        if (typeof fallback === "function") {
            const res: any = await Promise.race([
                fallback(item).then(
                    (value: any) => ({ ok: true, value: !!(value && value.url) }),
                    () => ({ ok: false, value: false }),
                ),
                new Promise(resolve =>
                    setTimeout(
                        () => resolve({ ok: false, value: false }),
                        15000,
                    ),
                ),
            ]);
            if (res?.ok) {
                cache.set(key, { value: !!res.value, ts: Date.now() });
            }
        }
    } catch {
        // 插件异常不写死，留待下次
    } finally {
        inQueue.delete(key);
    }
}

export function requestMvBadge(item: any) {
    if (!item?.id) {
        return;
    }
    const key = keyOf(item);
    if (cache.has(key) || inQueue.has(key)) {
        return;
    }
    inQueue.add(key);
    queue.push(item);
    pump();
}
