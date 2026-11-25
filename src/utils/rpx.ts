import { Dimensions } from "react-native";
import { isTvBuild } from "@/tv/keyEvent";

const windowWidth = Dimensions.get("window").width;
const windowHeight = Dimensions.get("window").height;
const minWindowEdge = Math.min(windowHeight, windowWidth);
const maxWindowEdge = Math.max(windowHeight, windowWidth);

/**
 * 手机端设计稿以 750 宽度为基准；电视端是横屏大屏，按 minEdge 等比放大会让元素过大。
 * 这里把 750 设计单位映射到「屏高的 90%」，保证 720p / 1080p / 4K 盒子上元素占屏比例一致，
 * 符合客厅 2.5~3.5 米的观看距离（列表行约占屏高 13%）。
 */
const TV_EDGE_RATIO = 0.9;
const designEdge = isTvBuild ? minWindowEdge * TV_EDGE_RATIO : minWindowEdge;

export default function (rpx: number) {
    return (rpx / 750) * designEdge;
}

export function vh(pct: number) {
    return (pct / 100) * Dimensions.get("window").height;
}

export function vw(pct: number) {
    return (pct / 100) * Dimensions.get("window").width;
}

export function vmin(pct: number) {
    return (pct / 100) * minWindowEdge;
}

export function vmax(pct: number) {
    return (pct / 100) * maxWindowEdge;
}

export function sh(pct: number) {
    return (pct / 100) * Dimensions.get("screen").height;
}

export function sw(pct: number) {
    return (pct / 100) * Dimensions.get("screen").width;
}
