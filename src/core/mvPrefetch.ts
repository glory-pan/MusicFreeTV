/**
 * MV 预取：歌一开播就在后台把 MV 地址解析好（插件内部有 30 分钟缓存）。
 * 这样按遥控器「视频」时是直接命中缓存，不用再等七八秒。
 */
import pluginManager from "@/core/pluginManager";

const inflight = new Set<string>();
const done = new Map<string, number>();
const DONE_TTL = 30 * 60 * 1000;

export function prefetchMusicVideo(music: any) {
    if (!music || !music.id) {
        return;
    }
    const key = `${music.platform ?? ""}|${music.id}`;
    if (inflight.has(key)) {
        return;
    }
    const ts = done.get(key);
    if (ts && Date.now() - ts < DONE_TTL) {
        return;
    }
    try {
        const plugin: any = pluginManager.getByMedia(music);
        const hasMv = plugin?.supportedMethods?.has?.("getMusicVideo");
        if (!hasMv) {
            return;
        }
        inflight.add(key);
        const task = Promise.resolve(
            plugin.methods.getMusicVideo(music, { attempt: 0 }),
        )
            .then(() => {
                done.set(key, Date.now());
            })
            .catch(() => {
                // 没匹配到就算了，用户真点视频时还会再试一次
            })
            .then(() => {
                inflight.delete(key);
            });
        // 15 秒还没回来就放弃这次预取，别一直占着
        setTimeout(() => {
            inflight.delete(key);
        }, 15000);
        return task;
    } catch {
        inflight.delete(key);
    }
}
