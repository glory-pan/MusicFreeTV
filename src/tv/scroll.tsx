import React, {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useRef,
} from "react";
import {
    FlatList as RNFlatList,
    ScrollView as RNScrollView,
    SectionList as RNSectionList,
    View,
} from "react-native";
import { FlashList as RNFlashList } from "@shopify/flash-list";
import { tvFocus } from "./focusStore";
import { TvRect } from "./types";


/**
 * 统一滚动：FlatList 有 scrollToOffset，ScrollView 有 scrollTo，
 * SectionList 只能通过 getScrollResponder 拿到内部 ScrollView。
 * 之前只调 scrollToOffset，导致设置页 SectionList 永远滚不动（焦点跑到屏幕外就"消失"）。
 */
function applyScrollTo(target: any, offset: number, horizontal: boolean) {
    if (!target) {
        return;
    }
    const opts = horizontal
        ? { x: offset, animated: true }
        : { y: offset, animated: true };
    try {
        if (typeof target.scrollToOffset === "function") {
            target.scrollToOffset({ offset, animated: true });
            return;
        }
    } catch {
        // 继续尝试下一种
    }
    try {
        if (typeof target.scrollTo === "function") {
            target.scrollTo(opts);
            return;
        }
    } catch {
        // 继续尝试下一种
    }
    try {
        const responder =
            typeof target.getScrollResponder === "function"
                ? target.getScrollResponder()
                : null;
        if (responder) {
            if (typeof responder.scrollTo === "function") {
                responder.scrollTo(opts);
                return;
            }
            if (typeof responder.scrollResponderScrollTo === "function") {
                responder.scrollResponderScrollTo(opts);
            }
        }
    } catch {
        // ignore
    }
}

function clampPositive(value: number) {
    return value > 0 ? value : 0;
}

/**
 * 计算把 rect 滚进视口所需的目标 offset；已经在视口内返回 null。
 */
function computeTargetOffset(
    rect: TvRect,
    view: TvRect,
    horizontal: boolean,
    current: number,
): number | null {
    if (horizontal) {
        const margin = Math.min(view.width * 0.14, 180);
        if (rect.x < view.x + margin) {
            return clampPositive(current + (rect.x - (view.x + margin) - 12));
        }
        if (rect.x + rect.width > view.x + view.width - margin) {
            return clampPositive(
                current + (rect.x + rect.width - (view.x + view.width - margin) + 12),
            );
        }
        return null;
    }
    const margin = Math.min(view.height * 0.1, 100);
    if (rect.y < view.y + margin) {
        return clampPositive(current + (rect.y - (view.y + margin) - 12));
    }
    if (rect.y + rect.height > view.y + view.height - margin) {
        return clampPositive(
            current + (rect.y + rect.height - (view.y + view.height - margin) + 12),
        );
    }
    return null;
}

/**
 * 把当前滚动容器注册进焦点引擎：焦点落到视口外的元素时自动滚进可视区。
 * 电视上没有"手指滚动"，这是列表能不能被完整操作的关键。
 */
function useScrollContainerRegistration(
    horizontal: boolean,
    viewportRef: React.RefObject<any>,
    offsetRef: React.MutableRefObject<number>,
    applyOffset: React.RefObject<(offset: number) => void>,
) {
    useEffect(() => {
        const container = {
            ensureVisible(rect: TvRect) {
                const node = viewportRef.current;
                if (!node || typeof node.measureInWindow !== "function") {
                    return;
                }
                node.measureInWindow(
                    (x: number, y: number, width: number, height: number) => {
                        if (width < 1 || height < 1) {
                            return;
                        }
                        const target = computeTargetOffset(
                            rect,
                            { x, y, width, height },
                            horizontal,
                            offsetRef.current ?? 0,
                        );
                        if (target == null) {
                            return;
                        }
                        offsetRef.current = target;
                        applyOffset.current?.(target);
                    },
                );
            },
        };
        return tvFocus.registerScrollContainer(container);
    }, [horizontal, viewportRef, offsetRef, applyOffset]);
}

function readScrollOffset(event: any, horizontal: boolean): number | null {
    const offset = horizontal
        ? event?.nativeEvent?.contentOffset?.x
        : event?.nativeEvent?.contentOffset?.y;
    return typeof offset === "number" ? offset : null;
}

/**
 * 电视端滚动容器。
 */
export const TvScrollView = forwardRef<any, any>(function TvScrollView(
    props,
    ref,
) {
    const inner = useRef<any>(null);
    useImperativeHandle(ref, () => inner.current);

    const offsetRef = useRef(0);
    const horizontal = !!props.horizontal;
    const applyOffset = useRef<(offset: number) => void>(() => {});

    applyOffset.current = (offset: number) => {
        applyScrollTo(inner.current, offset, horizontal);
    };

    useScrollContainerRegistration(horizontal, inner, offsetRef, applyOffset);

    return (
        <RNScrollView
            {...props}
            ref={inner}
            scrollEventThrottle={props.scrollEventThrottle ?? 16}
            onScroll={(event: any) => {
                const offset = readScrollOffset(event, horizontal);
                if (offset != null) {
                    offsetRef.current = offset;
                }
                props.onScroll?.(event);
            }}
        />
    );
});

/**
 * FlashList（RecyclerListView 实现）无法通过 measure 拿到视口，这里在外部包一层
 * 用于测量的容器，列表本身填满容器，布局语义与原来保持一致。
 */
export const TvFlashList = forwardRef<any, any>(function TvFlashList(
    props,
    ref,
) {
    const list = useRef<any>(null);
    const viewport = useRef<any>(null);
    const offsetRef = useRef(0);
    useImperativeHandle(ref, () => list.current);

    const horizontal = !!props.horizontal;
    const applyOffset = useRef<(offset: number) => void>(() => {});

    applyOffset.current = (offset: number) => {
        applyScrollTo(list.current, offset, horizontal);
    };

    if (!props.disableTvAutoScroll) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useScrollContainerRegistration(
            horizontal,
            viewport,
            offsetRef,
            applyOffset,
        );
    }

    return (
        <View
            ref={viewport}
            style={props.style ?? fillStyle}
            collapsable={false}>
            <RNFlashList
                {...(props as any)}
                style={listStyle}
                ref={list}
                scrollEventThrottle={props.scrollEventThrottle ?? 16}
                onScroll={(event: any) => {
                    const offset = readScrollOffset(event, horizontal);
                    if (offset != null) {
                        offsetRef.current = offset;
                    }
                    props.onScroll?.(event);
                }}
            />
        </View>
    );
});

/**
 * FlatList 电视版：外部包一层可测量容器 + 自动滚动。
 * 设置页、插件列表等大量使用 FlatList，缺了它焦点就会跑到屏幕外。
 */
export const TvFlatList = forwardRef<any, any>(function TvFlatList(
    props,
    ref,
) {
    const list = useRef<any>(null);
    const viewport = useRef<any>(null);
    const offsetRef = useRef(0);
    useImperativeHandle(ref, () => list.current ?? viewport.current);

    const horizontal = !!props.horizontal;
    const applyOffset = useRef<(offset: number) => void>(() => {});

    applyOffset.current = (offset: number) => {
        applyScrollTo(list.current, offset, horizontal);
    };

    useScrollContainerRegistration(horizontal, viewport, offsetRef, applyOffset);

    return (
        <View
            ref={viewport}
            style={props.style ?? fillStyle}
            collapsable={false}>
            <RNFlatList
                {...(props as any)}
                style={listStyle}
                ref={list}
                scrollEventThrottle={props.scrollEventThrottle ?? 16}
                onScroll={(event: any) => {
                    const offset = readScrollOffset(event, horizontal);
                    if (offset != null) {
                        offsetRef.current = offset;
                    }
                    props.onScroll?.(event);
                }}
            />
        </View>
    );
});

/**
 * SectionList 电视版：设置页十个板块（常规 / 歌单&专辑 / 插件 / 播放 / 下载 /
 * 网络 / 歌词 / 缓存 / 开发者选项…）都靠它渲染，必须支持焦点自动滚动。
 */
export const TvSectionList = forwardRef<any, any>(function TvSectionList(
    props,
    ref,
) {
    const list = useRef<any>(null);
    const viewport = useRef<any>(null);
    const offsetRef = useRef(0);
    useImperativeHandle(ref, () => list.current ?? viewport.current);

    const horizontal = !!props.horizontal;
    const applyOffset = useRef<(offset: number) => void>(() => {});

    applyOffset.current = (offset: number) => {
        applyScrollTo(list.current, offset, horizontal);
    };

    useScrollContainerRegistration(horizontal, viewport, offsetRef, applyOffset);

    return (
        <View
            ref={viewport}
            style={props.style ?? fillStyle}
            collapsable={false}>
            <RNSectionList
                {...(props as any)}
                style={listStyle}
                ref={list}
                scrollEventThrottle={props.scrollEventThrottle ?? 16}
                onScroll={(event: any) => {
                    const offset = readScrollOffset(event, horizontal);
                    if (offset != null) {
                        offsetRef.current = offset;
                    }
                    props.onScroll?.(event);
                }}
            />
        </View>
    );
});

/**
 * 通用 ListView（部分老代码用 ListView），同样需要自动滚动。
 */
export const TvListView = TvFlatList;

const listStyle = { flex: 1, width: "100%" } as const;
const fillStyle = { flex: 1 } as const;
