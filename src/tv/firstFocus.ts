import { useEffect } from "react";
import { tvFocus } from "./focusStore";

/**
 * 页面级"首焦点"兜底。
 *
 * 很多页面（作者页、歌单详情、推荐歌单、榜单）进页面时列表数据还在拉取，
 * 节点注册时间点不确定，只靠按键触发的自愈会出现"进去一片黑、怎么按都没光环"。
 * 这里在页面挂载后的几个时间点复查一次：只要屏幕上没有可见光环，
 * 就把当前图层里最靠前的元素点亮。
 */
export function useTvPageFirstFocus(enabled = true) {
    useEffect(() => {
        if (!enabled) {
            return;
        }
        const timers = [180, 420, 800, 1200, 1800].map(delay =>
            setTimeout(() => {
                if (!tvFocus.hasVisibleFocus()) {
                    tvFocus.focusFirstInActiveLayer();
                }
            }, delay),
        );
        return () => timers.forEach(timer => clearTimeout(timer));
    }, [enabled]);
}
