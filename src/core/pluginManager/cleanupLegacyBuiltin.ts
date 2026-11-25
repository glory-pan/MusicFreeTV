import pluginManager from "@/core/pluginManager";
import { devLog } from "@/utils/log";

/**
 * 老版本内置过的四个音乐源（网易云/酷狗/酷我/QQ音乐）。
 *
 * 这些源已经整体移除，只留 musicfree 插件体系。但老用户机器上还装着这几个插件文件，
 * 启动时按"文件名带 builtin-" 认出来卸掉，避免插件页里还残留四张用不了的卡片。
 */
const LEGACY_BUILTIN_FILE_PREFIX = "builtin-";

export async function removeLegacyBuiltinPlugins() {
    try {
        const plugins = pluginManager.getSortedPlugins() ?? [];
        for (const plugin of plugins) {
            const path = String((plugin as any)?.path ?? "");
            if (!path.includes(LEGACY_BUILTIN_FILE_PREFIX)) {
                continue;
            }
            try {
                await pluginManager.uninstallPlugin(plugin.hash);
                devLog("log", "移除旧内置源", plugin.name, path);
            } catch (e: any) {
                devLog("log", "移除旧内置源失败", plugin.name, e?.message ?? e);
            }
        }
    } catch {}
}
