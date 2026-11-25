export interface TvRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** 可滚动容器，用于把获得焦点的元素滚进电视可视区 */
export interface ITvScrollContainer {
    ensureVisible(rect: TvRect): void;
}
