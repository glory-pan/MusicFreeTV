/**
 * 遥控器空间焦点引擎。
 *
 * 手机端应用所有的可见元素都依赖「触摸 + 手势」，电视盒子只有方向键、OK 和返回。
 * 这里把每个可交互元素注册成焦点节点，用几何最近邻算法在节点之间移动焦点，
 * 由节点自己绘制焦点框（不再依赖全局坐标换算），并把 OK 键派发成 onPress。
 */

import { Dimensions } from "react-native";
import { ITvScrollContainer, TvRect } from "./types";

export type Direction = "up" | "down" | "left" | "right";

export interface ITvFocusNodeOptions {
    /** 测量节点在窗口中的位置 */
    measure: (callback: (rect: TvRect | null) => void) => void;
    onPress?: () => void;
    onLongPress?: () => void;
    disabled?: boolean;
    /** 浮层图层（弹窗、抽屉），数值越大越优先 */
    layer?: number;
    /** 便于调试 */
    debugName?: string;
    /** 显式焦点顺序（越大越靠后）；不填则按注册顺序 */
    order?: number;
    /** 所属页面作用域（由 TvScope 的 context 给出，注册时就确定，不依赖路由事件的时序） */
    scope?: number;
    /**
     * 显式方向链接（按 debugName 指名目标节点）。
     * 版式上"开关在右上角、按钮在它左下方"这类布局，几何导航判不出相邻关系
     * （交叉轴不重叠、偏移又远大于阈值），实机表现就是"按左/按右完全没反应"。
     * 这里允许页面直接声明"按这个方向该去哪个节点"。
     */
    leftName?: string;
    rightName?: string;
    upName?: string;
    downName?: string;
}

export interface ITvFocusNode extends ITvFocusNodeOptions {
    id: number;
    /** 注册时所属的页面作用域 */
    scope?: number;
}

interface IMeasuredNode {
    node: ITvFocusNode;
    rect: TvRect;
}

const BASE_LAYER = 1;
/** 主方向距离的权重固定为 1，交叉轴偏移的权重 */
const CROSS_WEIGHT_ALIGNED = 0.9;
const CROSS_WEIGHT_UNALIGNED = 3.4;

function screenRect(): TvRect {
    const { width, height } = Dimensions.get("window");
    return { x: 0, y: 0, width, height };
}

function visibleRatio(rect: TvRect, screen: TvRect): number {
    const left = Math.max(rect.x, screen.x);
    const top = Math.max(rect.y, screen.y);
    const right = Math.min(rect.x + rect.width, screen.x + screen.width);
    const bottom = Math.min(rect.y + rect.height, screen.y + screen.height);
    const w = right - left;
    const h = bottom - top;
    if (w <= 0 || h <= 0) {
        return 0;
    }
    const area = rect.width * rect.height;
    return area > 0 ? (w * h) / area : 0;
}

/** 两个矩形在交叉轴上的重叠长度（水平移动看纵向重叠，垂直移动看横向重叠） */
function crossOverlap(from: TvRect, to: TvRect, horizontal: boolean): number {
    if (horizontal) {
        return Math.min(from.y + from.height, to.y + to.height) - Math.max(from.y, to.y);
    }
    return Math.min(from.x + from.width, to.x + to.width) - Math.max(from.x, to.x);
}

/** 上一次成功测量到的 rect，测量超时时作为兜底，避免整页节点集体失效 */
const rastCache = new Map<number, TvRect>();

class TvFocusStore {
    private nodes = new Map<number, ITvFocusNode>();
    private idSeq = 0;
    private layerSeq = BASE_LAYER;
    private focusedId: number | null = null;
    /** 面板会话：浮层一建立就开，会话里第一个画出来的按钮直接拿光环 */
    private panelSession = 0;
    private panelSessionFocused = false;
    private focusedRect: TvRect | null = null;
    private ringListeners = new Set<() => void>();
    private focusListeners = new Map<number, Set<() => void>>();
    private refocusTimer: ReturnType<typeof setTimeout> | null = null;
    /** 每层上一次的焦点，用于关闭浮层后恢复 */
    private layerFocusHistory = new Map<number, number>();
    /** 在某页面按 OK 离开时的落点：返回该页面时必须回到这个元素 */
    private routeReturnName = new Map<string, string>();
    private refocusRetry = 0;
    private watchdogTicks = 0;
    /** 序列模式：完全按 order/注册顺序上下移动，不依赖坐标测量 */
    private orderMode = 0;
    private longPressTimer: ReturnType<typeof setTimeout> | null = null;
    private longPressFired = false;
    /** 全局滚动容器：焦点变化时把所有容器里的目标滚进可视区 */
    private scrollContainers = new Set<ITvScrollContainer>();
    /** 页面作用域：每个 screen / 浮层挂载时 push，卸载时 pop */
    private scopeSeq = 0;
    private scopeStack: number[] = [];
    private currentScope = 0;
    /** 当前路由名（只用于焦点记忆，不参与节点归属判断） */
    private currentRoute = "";
    /** 每个路由最后一次的焦点名字（仅在没有 scope 记忆时兜底） */
    private routeFocusName = new Map<string, string>();
    /**
     * 每个页面实例（scope）最后一次的焦点名字。
     * 用 scope 而不是路由名：同一个路由会被不同歌单/不同设置页复用，
     * 按路由名记会把 A 歌单的第 39 首记到 B 歌单，返回时焦点就"跳到第 39 首"。
     */
    private scopeFocusName = new Map<number, string>();
    /** 面板（浮层）里最后聚焦的元素，按面板 key 记，重开时回到上次选中的那一项 */
    private panelMemo = new Map<string, string>();
    /** 页面上（非浮层）最后一次聚焦的元素：面板关闭后一律回到它 */
    private lastPageFocusName: string | null = null;
    /** 面板当前 key（打开时由 TvCardPanel 设置） */
    private panelKey: string | null = null;
    /** 严格作用域：面板打开期间，焦点绝对不许跑到卡片外面（跑出去 = 光环消失、按键乱） */
    private strictScopes = new Set<number>();
    /** 最近聚焦过的节点 id：焦点离开后要通知它们重渲染，清掉残留光环 */
    private recentFocusIds: number[] = [];

    private rememberFocus(id: number) {
        const idx = this.recentFocusIds.indexOf(id);
        if (idx >= 0) {
            this.recentFocusIds.splice(idx, 1);
        }
        this.recentFocusIds.push(id);
        if (this.recentFocusIds.length > 6) {
            this.recentFocusIds.shift();
        }
    }

    /** 通知"曾经聚焦过的节点"全部重渲染：只有 focusedId 一个会真的画光环 */
    private refreshRecentFocus(exceptId?: number) {
        this.recentFocusIds.forEach(id => {
            if (id !== exceptId) {
                this.notifyNodeFocus(id);
            }
        });
    }
    /** 延迟聚焦请求：页面 mount 时节点还没注册，注册成功就自动落上去 */
    private pendingFocusName: string | null = null;
    private pendingFocusTimer: ReturnType<typeof setTimeout> | null = null;

    /**
     * 候选池分级：优先只在本页面的节点里导航（上一页残留的节点不该被选中），
     * 但本页一个候选都没有时必须退回全集 ——
     * 硬性过滤会把候选清空，直接导致"整页没有光环、怎么按都没反应"。
     */
    private preferSameRoute<T extends { node: ITvFocusNode }>(items: T[]): T[] {
        const sticky = this.strictScope();
        if (sticky) {
            // 面板内部：只在卡片里找，找不到就留在原地（宁可不移动，也不能让光环跑到卡片外）
            return items.filter(item => item.node.scope === sticky);
        }
        const same = items.filter(item => this.nodeOfCurrentRoute(item.node));
        return same.length ? same : items;
    }

    /**
     * 当前页面实例（scope）里的可聚焦节点。
     * native-stack 会把旧页面的组件实例留在内存里，它们的节点同样还注册着，
     * 按名字找焦点时必须优先认这些"当前实例"的节点，否则光环会落到看不见的旧节点上
     * —— 表现就是"光环消失、怎么按都没反应"。
     */
    private currentScopeNodes(): ITvFocusNode[] {
        const scope = this.currentScope;
        if (!scope) {
            return [];
        }
        return [...this.nodes.values()].filter(
            node =>
                node.scope === scope &&
                !node.disabled &&
                this.focusListeners.has(node.id),
        );
    }

    /** 当前作用域节点所在的最高图层 */
    private currentScopeLayer(): number {
        let layer = 0;
        for (const node of this.currentScopeNodes()) {
            const l = node.layer ?? BASE_LAYER;
            if (l > layer) {
                layer = l;
            }
        }
        return layer;
    }

    /** 严格作用域里的全部可聚焦节点 */
    private strictNodes(): ITvFocusNode[] {
        const sticky = this.strictScope();
        if (!sticky) {
            return [];
        }
        return [...this.nodes.values()].filter(
            node =>
                node.scope === sticky &&
                !node.disabled &&
                this.focusListeners.has(node.id),
        );
    }

    createScope(): number {
        return ++this.scopeSeq;
    }

    /** 新页面/浮层挂载：成为当前作用域 */
    pushScope(scope: number, strict = false) {
        this.scopeStack.push(scope);
        this.currentScope = scope;
        if (strict) {
            this.strictScopes.add(scope);
        }
    }

    popScope(scope: number) {
        const idx = this.scopeStack.lastIndexOf(scope);
        if (idx >= 0) {
            this.scopeStack.splice(idx, 1);
        }
        this.strictScopes.delete(scope);
        this.currentScope = this.scopeStack[this.scopeStack.length - 1] ?? 0;
        // 浮层关掉后把光环送回打开它的那个元素上：
        // 每一层自己的焦点都记着，所以"点开列表→关闭→回到列表按钮"是自动成立的
        // 回到"上一层页面自己的焦点"：面板关闭 -> 回到打开它的按钮；
        // 播放页/歌单页返回 -> 回到该页面最后停的那一项。
        // 不能用全局的 lastPageFocusName，否则会被别的页面的焦点覆盖
        // （比如从推荐歌单播歌再返回主页，光环会落到"插件"上）
        const back =
            this.scopeFocusName.get(this.currentScope) ||
            this.lastPageFocusName;
        setTimeout(() => {
            if (this.currentScope !== scope && this.currentScope > 0) {
                if (back && this.focusByName(back)) {
                    return;
                }
            }
            if (back && this.focusByName(back)) {
                return;
            }
            if (!this.hasVisibleFocus()) {
                this.scheduleRefocus();
            }
        }, 180);
    }

    /** 当前是否处在"面板内部"（严格作用域） */
    private strictScope(): number {
        const scope = this.currentScope;
        if (!scope || !this.strictScopes.has(scope)) {
            return 0;
        }
        // 作用域里必须真的有节点才收紧；万一 scope 传递没对上，
        // 直接放宽而不是把方向键全锁死（宁可变松，绝不能再"按不动"）
        for (const node of this.nodes.values()) {
            if (node.scope === scope) {
                return scope;
            }
        }
        return 0;
    }

    /**
     * 一次聚焦要同时维护三类记忆：
     * 1) 页面实例记忆（scope）：返回同一页面时回到原处；
     * 2) 面板记忆：同一张卡片重开时回到上次选中的那一项（用户选"小"就停在"小"）；
     * 3) 页面最后聚焦项：卡片关掉后一律回到打开它的那个按钮。
     */
    private rememberFocusName(name: string, scope: number) {
        const strict = scope && this.strictScopes.has(scope);
        if (!strict) {
            this.lastPageFocusName = name;
            if (scope) {
                this.scopeFocusName.set(scope, name);
            }
            if (this.currentRoute) {
                this.routeFocusName.set(this.currentRoute, name);
            }
        } else if (this.panelKey) {
            // 面板块里选中的项，关掉之后重开要回到它
            this.panelMemo.set(this.panelKey, name);
        }
        if (scope) {
            this.scopeFocusName.set(scope, name);
        }
    }

    /** 面板记忆：打开时回填 key，关闭时记下最后选中的元素 */
    setPanelKey(key: string | null) {
        this.panelKey = key;
    }

    rememberPanelFocus() {
        if (this.panelKey) {
            const name = this.getFocusedNode()?.debugName;
            // 关卡片时光环常常正停在右上角的 ×，记它没意义，
            // 否则下次打开面板首焦点又会跑到关闭键上
            if (name && name !== "tvcard:close") {
                this.panelMemo.set(this.panelKey, name);
            }
        }
    }

    getPanelMemo(key: string): string | undefined {
        return this.panelMemo.get(key);
    }

    /**
     * 节点是否属于当前页面作用域。
     * 之前按"路由名"判断，但节点往往在 onStateChange 之前就注册好了，
     * 于是设置页/插件页/主题页的节点会被判成"上一个页面的"，全被过滤掉 ——
     * 用户看到的就是"进去一个光环都没有、怎么按都没反应"。
     * 改用挂载时就确定的 scope，不再有时序问题。
     */
    private nodeOfCurrentRoute(node: ITvFocusNode) {
        // 浮层（弹窗/面板/抽屉）里的节点天然属于当前页面：
        // 它们带的是浮层新建的作用域，如果还按"scope 必须等于当前页面"来判，
        // 整张卡片会被当成"别的页面的残留"全部过滤掉 ——
        // 结果就是弹框弹出来了、里面一个光环都没有（用户反复反馈的就是这个）
        if ((node.layer ?? BASE_LAYER) > BASE_LAYER) {
            return true;
        }
        if (!node.scope) {
            return true;
        }
        if (!this.currentScope) {
            return true;
        }
        return node.scope === this.currentScope;
    }

    /**
     * 开启/关闭序列导航模式。插件页、播放页、均衡器页这类
     * "控件密集、坐标测量不稳定"的页面用它，方向键按 order 顺序一格格走，
     * 避免几何最近邻在测量失败时乱跳。
     */
    setOrderMode(enabled: boolean) {
        this.orderMode += enabled ? 1 : -1;
        if (this.orderMode < 0) {
            this.orderMode = 0;
        }
        this.refocusRetry = 0;
        this.scheduleRefocus();
    }

    // ---------- 节点注册 ----------

    register(options: ITvFocusNodeOptions): number {
        const id = ++this.idSeq;
        this.nodes.set(
            id,
            {
                ...options,
                id,
                scope: options.scope ?? this.currentScope,
            },
        );
        const created = this.nodes.get(id);
        if (created && this.focusedId === id) {
            this.notifyNodeFocus(id);
        }
        // 面板会话进行中：第一个注册的可聚焦元素直接点亮，然后立刻收手。
        // 这里刻意**不判断图层和作用域**，因为它们正是前几轮失败的地方。
        if (
            created &&
            !created.disabled &&
            this.panelSession > 0 &&
            !this.panelSessionFocused &&
            created.debugName !== "tvcard:close" &&
            created.debugName !== "appbar:back"
        ) {
            this.panelSessionFocused = true;
            this.focusNode(created);
        }
        // 页面 mount 时挂起的聚焦请求：目标节点一出现就落上去，
        // 不用等用户按键/轮询定时器
        if (
            this.pendingFocusName &&
            options.debugName === this.pendingFocusName
        ) {
            const name = this.pendingFocusName;
            this.pendingFocusName = null;
            if (this.pendingFocusTimer) {
                clearTimeout(this.pendingFocusTimer);
                this.pendingFocusTimer = null;
            }
            setTimeout(() => this.focusByName(name));
        } else {
            this.scheduleRefocus();
        }
        return id;
    }

    update(id: number, options: Partial<ITvFocusNodeOptions>) {
        const node = this.nodes.get(id);
        if (!node) {
            return;
        }
        Object.assign(node, options);
    }

    unregister(id: number) {
        if (!this.nodes.has(id)) {
            return;
        }
        this.nodes.delete(id);
        if (this.focusedId === id) {
            this.focusedId = null;
            this.focusedRect = null;
            this.emitRing();
            this.scheduleRefocus();
        }
        this.focusListeners.delete(id);
    }

    // ---------- 滚动容器 ----------

    registerScrollContainer(container: ITvScrollContainer) {
        this.scrollContainers.add(container);
        return () => {
            this.scrollContainers.delete(container);
        };
    }

    private scrollIntoView(rect: TvRect) {
        if (!rect || rect.width <= 0 || rect.height <= 0) {
            return;
        }
        this.scrollContainers.forEach(container => {
            try {
                container.ensureVisible(rect);
            } catch {
                // 单个容器失败不影响其它容器与焦点
            }
        });
    }

    // ---------- 图层（弹窗/抽屉） ----------

    createLayer(): number {
        return ++this.layerSeq;
    }

    /**
     * 打开"面板会话"。由浮层在自己的 render 阶段调用（早于任何子按钮注册），
     * 所以之后**第一个注册进来的可聚焦元素**就是面板里的第一行，直接给它光环。
     * 不看图层号、不看作用域、不看坐标测量 —— 这三个东西在真机上都曾经对不上，
     * 结果就是"弹框弹出来了却一个光环都没有"。
     */
    openPanelSession() {
        this.panelSession += 1;
        this.panelSessionFocused = false;
    }

    closePanelSession() {
        this.panelSession = 0;
        this.panelSessionFocused = false;
    }

    /**
     * 活动图层 = **最近注册的节点**所在的图层。
     * 之前用"所有节点里的最大图层号"，一旦某个浮层留下过更高的图层号，
     * 页面节点就永远不参与测量和导航 —— 表现就是"整页没有光环、乱按才偶尔落一个"。
     */
    private activeLayer(): number {
        // 取"当前路由里还存在节点的最大图层"：弹窗/面板图层更大，因此会压住背后的页面。
        // 必须按路由过滤：上一个页面（含它的浮层）残留的更高图层号，
        // 会让新页面的节点全部落在其它层里 —— 表现就是"整页没有光环、怎么按都没反应"。
        let scoped = 0;
        let scopedDrawable = 0;
        let any = 0;
        let anyDrawable = 0;
        for (const node of this.nodes.values()) {
            const l = node.layer ?? BASE_LAYER;
            if (l > any) {
                any = l;
            }
            const drawable = this.focusListeners.has(node.id);
            if (drawable && l > anyDrawable) {
                anyDrawable = l;
            }
            if (this.nodeOfCurrentRoute(node)) {
                if (l > scoped) {
                    scoped = l;
                }
                if (drawable && l > scopedDrawable) {
                    scopedDrawable = l;
                }
            }
        }
        if (scopedDrawable || anyDrawable) {
            // 有能画光环的节点时，只认它们所在的层：
            // 否则会把焦点落进一个"纯容器层"（层号更大但没有可聚焦元素），
            // 表现就是"进去了没有光环、按方向键也不动"。
            return scopedDrawable || anyDrawable;
        }
        // 当前页面一个节点都没有时退到全局最大层：
        // 宁可先把光环落在某个节点上，也不能返回一个空层（空层 = 整页无光环、按键全哑）
        return scoped || any || BASE_LAYER;
    }

    /** 当前图层里按注册顺序（≈渲染顺序）排列的节点 */
    private layerNodesOrdered(layer: number): ITvFocusNode[] {
        return [...this.nodes.values()]
            .filter(
                node => (node.layer ?? BASE_LAYER) === layer && !node.disabled,
            )
            .sort((a, b) => {
                const ao = a.order ?? 0;
                const bo = b.order ?? 0;
                if (ao !== bo) {
                    return ao - bo;
                }
                return a.id - b.id;
            });
    }

    /** 直接聚焦某个节点（允许没有坐标，光环由组件自身绘制） */
    focusNode(node: ITvFocusNode) {
        const previous = this.focusedId;
        this.focusedId = node.id;
        const cached = rastCache.get(node.id) ?? this.focusedRect ?? {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
        };
        this.lastFocusedRect = cached;
        this.focusedRect = cached;
        if (previous != null) {
            this.notifyNodeFocus(previous);
        }
        this.notifyNodeFocus(node.id);
        this.rememberFocus(node.id);
        this.refreshRecentFocus(node.id);
        this.emitRing();
        this.layerFocusHistory.set(node.layer ?? BASE_LAYER, node.id);
        if (node.debugName) {
            this.rememberFocusName(node.debugName, node.scope ?? 0);
        }
        this.ensureFocusedVisible();
    }

    // ---------- 测量 ----------

    private measureAll(layer: number): Promise<IMeasuredNode[]> {
        const targets = [...this.nodes.values()].filter(
            node => (node.layer ?? BASE_LAYER) === layer && !node.disabled,
        );
        return Promise.all(
            targets.map(
                node =>
                    new Promise<IMeasuredNode | null>(resolve => {
                        let settled = false;
                        const finish = (rect: TvRect | null) => {
                            if (settled) {
                                return;
                            }
                            settled = true;
                            if (
                                !rect ||
                                rect.width < 1 ||
                                rect.height < 1 ||
                                !isFinite(rect.x) ||
                                !isFinite(rect.y)
                            ) {
                                resolve(null);
                                return;
                            }
                            rastCache.set(node.id, rect);
                            resolve({ node, rect });
                        };
                        try {
                            node.measure(finish);
                        } catch {
                            finish(null);
                        }
                        // 兜底：某些组件 ref 不可测量时不阻塞焦点移动。
                        // 但 60ms 对首帧布局是不够的（列表/懒加载组件首帧往往还没 layout），
                        // 过短的超时会把整页节点判成"不可测量"，表现为"进去一个光环都没有"。
                        setTimeout(() => {
                            const cached = rastCache.get(node.id);
                            if (cached) {
                                finish(cached);
                                return;
                            }
                            finish(null);
                        }, 220);
                    }),
            ),
        ).then(list => this.filterContained(list.filter(Boolean) as IMeasuredNode[]));
    }

    /**
     * 列表行里常嵌着「更多操作」之类的小图标，它们本身也被注册成焦点节点。
     * 电视上如果焦点钻进一个 10% 大小的小图标，会让人完全失去空间感，
     * 这里把「被更大的可聚焦元素包住且明显更小」的节点降级掉，
     * 行级操作仍可通过长按 OK 完成。
     */
    private filterContained(items: IMeasuredNode[]): IMeasuredNode[] {
        // 电视端的经验：任何"按几何面积猜意图"的降级都会误杀真实按钮
        //（插件页三点/加号、播放页上一首、弹窗里的取消/不再提示都是这种）。
        // 这里全部保留，宁可在方向导航时多经过一个小按钮，也不能让按钮点不到。
        return items;
    }

    private unusedFilterContained(items: IMeasuredNode[]): IMeasuredNode[] {
        if (items.length < 2) {
            return items;
        }
        const area = (rect: TvRect) => rect.width * rect.height;
        return items.filter(item => {
            const containedBy = items.find(other => {
                if (other === item) {
                    return false;
                }
                const outer = other.rect;
                const inner = item.rect;
                const inside =
                    inner.x >= outer.x - 4 &&
                    inner.y >= outer.y - 4 &&
                    inner.x + inner.width <= outer.x + outer.width + 4 &&
                    inner.y + inner.height <= outer.y + outer.height + 4;
                if (!inside) {
                    return false;
                }
                // 只有"真的极小"的子节点才降级（例如行内 10px 的小角标）。
                // 之前用 0.18/0.45 过于激进，会把设置行、播放页控制按钮、
                // 插件页三点/加号这类"中等尺寸的真实按钮"一起吞掉，导致遥控点不到。
                return (
                    area(inner) <= area(outer) * 0.05 &&
                    inner.height <= outer.height * 0.25
                );
            });
            return !containedBy;
        });
    }

    // ---------- 焦点移动 ----------

    private pickInitial(measured: IMeasuredNode[]): IMeasuredNode | null {
        if (!measured.length) {
            return null;
        }
        // 只认"确实有 UI 订阅、能把光环画出来"的节点：
        // 之前会把焦点落到一个没有订阅的节点上，等于没有光环，
        // 表现就是"进去看不到光环，要按键才冒出来"。
        const renderable = measured.filter(item =>
            this.focusListeners.has(item.node.id),
        );
        if (renderable.length) {
            measured = renderable;
        }
        const screen = screenRect();
        const visible = measured.filter(
            item => visibleRatio(item.rect, screen) > 0.2,
        );
        const pool = visible.length ? visible : measured;
        const minY = Math.min(...pool.map(item => item.rect.y));
        const rowTolerance = Math.max(24, Math.abs(minY) * 0.04);
        const topRow = pool.filter(item => item.rect.y <= minY + rowTolerance);
        const candidates = topRow.length ? topRow : pool;
        return candidates.reduce((best, item) =>
            item.rect.x < best.rect.x ? item : best,
        );
    }

    private isInDirection(
        from: TvRect,
        to: TvRect,
        direction: Direction,
    ): boolean {
        const fromCx = from.x + from.width / 2;
        const fromCy = from.y + from.height / 2;
        const toCx = to.x + to.width / 2;
        const toCy = to.y + to.height / 2;
        switch (direction) {
            case "up":
                return fromCy - toCy > 6;
            case "down":
                return toCy - fromCy > 6;
            case "left":
                return fromCx - toCx > 6;
            case "right":
                return toCx - fromCx > 6;
        }
    }

    private score(
        from: TvRect,
        to: TvRect,
        direction: Direction,
    ): number {
        const fromCx = from.x + from.width / 2;
        const fromCy = from.y + from.height / 2;
        const toCx = to.x + to.width / 2;
        const toCy = to.y + to.height / 2;
        const horizontal = direction === "left" || direction === "right";
        const primary = horizontal
            ? Math.abs(toCx - fromCx)
            : Math.abs(toCy - fromCy);
        const secondary = horizontal
            ? Math.abs(toCy - fromCy)
            : Math.abs(toCx - fromCx);
        // 交叉轴上真正重叠的候选，偏移惩罚小；完全不重叠的（斜对角）惩罚大，
        // 这样网格逐行移动、左侧导航跳到内容区都不会"跨板块乱跳"
        const overlap = crossOverlap(from, to, horizontal);
        const weight = overlap > 0 ? CROSS_WEIGHT_ALIGNED : CROSS_WEIGHT_UNALIGNED;
        return primary + secondary * weight;
    }

    /** 按 debugName 精确聚焦（用于关键入口之间的跳转） */
    /**
     * 按名字聚焦。
     * defer=true 时若节点还没注册，记下请求，等该名字的节点一注册立刻落上去
     * （页面 mount 与节点注册的时序先后不定，这是"进页面第一下没有光环"的根源）。
     */
    /**
     * 按名字**强制**聚焦：不做"是不是当前页面/当前图层"的打分否决。
     * 有些页面（例如主题设置）的内容项会被作用域判据误判成"别处的节点"，
     * 于是进去时光环只能落到返回键上；这里给出一个确定能落上的通路。
     */
    focusByNameForce(name: string): boolean {
        let best: ITvFocusNode | null = null;
        let bestRank = -1;
        this.nodes.forEach(node => {
            if (node.debugName !== name || node.disabled) {
                return;
            }
            const rank =
                (node.layer ?? BASE_LAYER) * 1000 +
                (node.scope === this.currentScope ? 500 : 0) +
                (this.focusListeners.has(node.id) ? 100 : 0);
            if (rank > bestRank) {
                bestRank = rank;
                best = node;
            }
        });
        if (!best) {
            return false;
        }
        this.focusNode(best);
        return true;
    }

    focusByName(name: string, defer = false): boolean {
        const scopeLayer = this.currentScopeLayer();
        let best: ITvFocusNode | null = null;
        let bestScore = 0;
        for (const node of this.nodes.values()) {
            if (node.debugName !== name || node.disabled) {
                continue;
            }
            let score = 0;
            if (node.scope === this.currentScope) {
                score += 100;
            }
            if ((node.layer ?? BASE_LAYER) === scopeLayer) {
                score += 50;
            }
            if (this.nodeOfCurrentRoute(node)) {
                score += 20;
            }
            if (score > bestScore) {
                bestScore = score;
                best = node;
            }
        }
        // 连"当前路由"都对不上（说明这是旧页面残留/别的页面的节点）就宁可等，不要硬落。
        // 但全局组件（迷你播放条、页头）只在自己的首个路由注册一次，
        // 换个页面返回时它的 route 永远对不上——这种"名字全应用唯一"的节点要放行，
        // 否则从迷你播放条进播放页再返回，光环会掉到列表里的某首歌上。
        const sameNameCount = [...this.nodes.values()].filter(
            node => node.debugName === name && !node.disabled,
        ).length;
        if (best && (bestScore >= 10 || sameNameCount === 1)) {
            this.focusNode(best);
            return true;
        }
        if (defer) {
            this.pendingFocusName = name;
            if (this.pendingFocusTimer) {
                clearTimeout(this.pendingFocusTimer);
            }
            this.pendingFocusTimer = setTimeout(() => {
                this.pendingFocusName = null;
                this.pendingFocusTimer = null;
            }, 4000);
        }
        return false;
    }

    /**
     * 在**最新建立的浮层**里挑第一个可聚焦元素。
     * 判据只有"座位号（layer）是不是最大"，不看作用域、不看路由、不看坐标，
     * 因此不会像按 scope 判定那样把整张卡片当成残留节点过滤掉。
     */
    focusFirstInNewestFloat(): boolean {
        let maxLayer = BASE_LAYER;
        this.nodes.forEach(node => {
            const l = node.layer ?? BASE_LAYER;
            if (l > maxLayer) {
                maxLayer = l;
            }
        });
        if (maxLayer <= BASE_LAYER) {
            return false;
        }
        const nodes = [...this.nodes.values()].filter(
            node =>
                (node.layer ?? BASE_LAYER) === maxLayer &&
                !node.disabled &&
                node.debugName !== "tvcard:close" &&
                node.debugName !== "appbar:back",
        );
        if (!nodes.length) {
            return false;
        }
        nodes.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        this.focusNode(nodes[0]);
        return true;
    }

    /** 最新浮层里的可聚焦节点数（用于面板上的自检显示） */
    countNewestFloatNodes(): number {
        let maxLayer = BASE_LAYER;
        this.nodes.forEach(node => {
            const l = node.layer ?? BASE_LAYER;
            if (l > maxLayer) {
                maxLayer = l;
            }
        });
        let count = 0;
        this.nodes.forEach(node => {
            if ((node.layer ?? BASE_LAYER) === maxLayer && !node.disabled) {
                count += 1;
            }
        });
        return count;
    }

    /**
     * 只在指定图层里挑第一个可聚焦元素。
     * 面板打开时用它兜底：图层号是硬信号，不受 scope 传递、订阅时序影响，
     * 解决"卡片弹出来了但里面一个光环都没有"。
     */
    focusFirstInLayer(layer: number): boolean {
        const nodes = [...this.nodes.values()].filter(
            node => (node.layer ?? BASE_LAYER) === layer && !node.disabled,
        );
        if (!nodes.length) {
            return false;
        }
        const usable = nodes.filter(
            node =>
                node.debugName !== "tvcard:close" &&
                node.debugName !== "appbar:back",
        );
        const pool = usable.length ? usable : nodes;
        const sorted = [...pool].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        this.focusNode(sorted[0]);
        return true;
    }

    /** 面板/弹框打开后调用：把焦点立刻放到当前图层里最靠前的元素上 */
    focusFirstInActiveLayer(): boolean {
        const layer = this.activeLayer();
        // 候选从上到下逐级放宽，任何一级有货就落上去，绝不返回"什么也没做"
        const sticky = this.strictNodes();
        if (sticky.length) {
            const withoutBack0 = sticky.filter(
                node => node.debugName !== "appbar:back",
            );
            this.focusNode((withoutBack0.length ? withoutBack0 : sticky)[0]);
            return true;
        }
        const scoped = this.currentScopeNodes();
        if (scoped.length) {
            // 卡片里的关闭键 focusOrder 故意给了很小的值（为了不被方向键抢），
            // 但"进入卡片第一个光环"绝不能落在关闭键上 —— 单独排掉它
            // 返回键和卡片关闭键都不该是"进来第一下"的落点
            const pool = scoped.filter(
                node =>
                    node.debugName !== "tvcard:close" &&
                    node.debugName !== "appbar:back",
            );
            const use = pool.length ? pool : scoped;
            const sorted = [...use].sort(
                (a, b) => (a.order ?? 0) - (b.order ?? 0),
            );
            this.focusNode(sorted[0]);
            return true;
        }
        const allNodes = [...this.nodes.values()].filter(node => !node.disabled);
        if (!allNodes.length) {
            return false;
        }
        const same = allNodes.filter(node => this.nodeOfCurrentRoute(node));
        const base = same.length ? same : allNodes;
        const drawable = base.filter(node => this.focusListeners.has(node.id));
        const pool = drawable.length ? drawable : base;
        const inLayer = pool.filter(
            node => (node.layer ?? BASE_LAYER) === layer,
        );
        const candidates = inLayer.length ? inLayer : pool;
        // 页头返回键放最后：进页面/回到页面时把光环丢在返回键上最反直觉
        const withoutBack = candidates.filter(
            node => node.debugName !== "appbar:back",
        );
        const finalPool = withoutBack.length ? withoutBack : candidates;
        // 同一层里按声明的焦点顺序取第一个，而不是按注册先后 ——
        // 注册先后等于渲染先后，页头/侧栏往往先注册，容易把光环丢到边角控件上
        const sortedFinal = [...finalPool].sort(
            (a, b) => (a.order ?? 0) - (b.order ?? 0),
        );
        this.focusNode(sortedFinal[0]);
        return true;
    }

    /**
     * 路由切换后的焦点复位：旧页面的节点会陆续卸载，
     * 这里先清掉残留焦点和测量缓存，再在稍后确保新页面一定有一个光环——
     * 插件页、搜索页这种"进页面什么都没选中"的问题都从这里兜住。
     */
    onRouteChange(routeName?: string) {
        if (routeName) {
            this.currentRoute = routeName;
        }
        this.focusedId = null;
        this.focusedRect = null;
        this.lastFocusedRect = null;
        this.visibleTimerId = null;
        this.emitRing();

        const remembered = routeName
            ? this.routeReturnName.get(routeName) ??
              this.routeFocusName.get(routeName)
            : undefined;
        const restore = (delay: number) => {
            setTimeout(() => {
                const cur =
                    this.focusedId != null
                        ? this.nodes.get(this.focusedId)
                        : null;
                if (cur) {
                    return;
                }
                this.focusedId = null;
                this.focusedRect = null;
                // 优先回到离开该页面时所在的位置（插件→主页应回到"插件"那一项）
                if (remembered && this.focusByName(remembered)) {
                    return;
                }
                this.focusFirstInActiveLayer();
            }, delay);
        };
        restore(200);
        restore(520);
        restore(1000);
    }

    async move(direction: Direction) {
        const stale =
            this.focusedId != null ? this.nodes.get(this.focusedId) : null;
        if (this.focusedId != null && !stale) {
            // 节点已经被卸载了，焦点自然不存在
            this.focusedId = null;
            this.focusedRect = null;
            this.emitRing();
        }
        const layer = this.activeLayer();
        if (this.orderMode > 0) {
            // 序列模式：只按声明顺序移动，保证"按到哪走到哪"
            if (!this.moveByOrder(direction, layer)) {
                setTimeout(() => {
                    this.scheduleRefocus();
                }, 120);
            }
            return;
        }
        const measuredAll = await this.measureAll(layer);
        // 同层里混着旧页面实例的节点：只在"当前实例"里导航，
        // 否则按方向键会把光环送到一个看不见的元素上（＝光环消失）
        const ownScope = measuredAll.filter(
            item => item.node.scope === this.currentScope,
        );
        const measured = ownScope.length ? ownScope : measuredAll;
        if (!measured.length) {
            // 页面刚切换/列表懒加载时可能出现"暂时测不到"，先用顺序导航兜底
            if (this.moveByOrder(direction, layer)) {
                return;
            }
            // 顺序导航也走不动：直接把光环放到本页第一个可聚焦元素上，
            // 保证用户按一下方向键至少能看到光环在动
            if (this.focusFirstInActiveLayer()) {
                return;
            }
            setTimeout(() => {
                this.scheduleRefocus();
            }, 120);
            return;
        }
        const current =
            this.focusedId != null
                ? measured.find(item => item.node.id === this.focusedId)
                : null;

        if (current && !this.isOnScreen(current.rect)) {
            // 当前焦点停在屏幕外（页面返回、列表滚动、面板关闭后的残留）：
            // 继续以它为基准算方向，会导致所有候选都"不在该方向"，
            // 表现就是"光环看不见、按方向键完全没反应，只能强杀重开"。
            // 先把它拉回屏幕内最近的节点，下一键就能正常导航。
            if (this.pullFocusIntoView(current.node.id)) {
                return;
            }
            // 连"拉回来"都做不到（页面刚切换、测量缓存全是旧页面的坐标）：
            // 直接把光环落到本层第一个可聚焦节点，别让用户按了十几下都看不到光环。
            if (this.focusFirstInActiveLayer()) {
                return;
            }
            this.focusedId = null;
        }

        if (!current) {
            const initial = this.pickInitial(this.preferSameRoute(measured));
            if (initial) {
                this.setFocus(initial);
                return;
            }
            if (this.moveByOrder(direction, layer)) {
                return;
            }
            if (this.focusFirstInActiveLayer()) {
                return;
            }
            setTimeout(() => {
                this.scheduleRefocus();
            }, 120);
            return;
        }

        // 先看当前节点有没有声明"这个方向该去哪"（例如插件卡片里开关 ←→ 操作按钮）。
        // 显式链接优先级最高：命中就直接落上去，命中不了（目标不在本页/未注册）再走几何。
        const hintName =
            direction === "left"
                ? current.node.leftName
                : direction === "right"
                  ? current.node.rightName
                  : direction === "up"
                    ? current.node.upName
                    : current.node.downName;
        if (hintName) {
            const hinted = measured.find(
                item => item.node.debugName === hintName,
            );
            if (hinted) {
                this.setFocus(hinted);
                return;
            }
            if (this.focusByName(hintName, true)) {
                return;
            }
        }

        const screen = screenRect();
        const horizontal = direction === "left" || direction === "right";
        const directionals: IMeasuredNode[] = [];
        for (const item of measured) {
            if (item.node.id === current.node.id) {
                continue;
            }
            if (this.isInDirection(current.rect, item.rect, direction)) {
                directionals.push(item);
            }
        }
        if (!directionals.length) {
            if (this.strictScope() && this.moveByOrder(direction, layer)) {
                return;
            }
            if (
                this.measurementBroken(layer, measured.length) &&
                this.moveByOrder(direction, layer)
            ) {
                return;
            }
            return;
        }
        // 先只在当前页面的节点里找目标（避免按下键跳到上一页残留的歌条）；
        // 当前页面在该方向上确实没有元素时，才放开到全部节点
        const scoped = this.preferSameRoute(directionals);

        // 交叉轴上有重叠的候选优先：先横向找同一行/同一列的元素，找不到才走斜对角
        const aligned = scoped.filter(
            item => crossOverlap(current.rect, item.rect, horizontal) > 0,
        );
        // 交叉轴没有重叠时只允许"轻微斜跳"：偏移不超过当前元素厚度的 60%，
        // 否则按右键会出现"往上跑"的错乱（设置页歌词板块就是这么出的问题）。
        const nearAligned = scoped.filter(item => {
            const offset = horizontal
                ? Math.min(
                      Math.abs(item.rect.y - (current.rect.y + current.rect.height)),
                      Math.abs(current.rect.y - (item.rect.y + item.rect.height)),
                      Math.abs(
                          item.rect.y +
                              item.rect.height / 2 -
                              (current.rect.y + current.rect.height / 2),
                      ),
                  )
                : Math.min(
                      Math.abs(item.rect.x - (current.rect.x + current.rect.width)),
                      Math.abs(current.rect.x - (item.rect.x + item.rect.width)),
                      Math.abs(
                          item.rect.x +
                              item.rect.width / 2 -
                              (current.rect.x + current.rect.width / 2),
                      ),
                  );
            const ref = horizontal ? current.rect.height : current.rect.width;
            return offset < ref * 1.2;
        });
        let pool = aligned.length ? aligned : nearAligned;
        if (!pool.length) {
            // 交叉轴差得太远（例如"歌单"页签在右边、下一行的内容在左边），
            // 上面的 nearAligned 会把它们全剔掉，实机表现就是"按下行键没反应"。
            // 这里给四个方向一个窄口子：整块在当前元素前方、且不远的节点里，
            // 挑交叉轴最近的一个。
            const ahead = scoped.filter(item => {
                switch (direction) {
                    case "up":
                        return (
                            item.rect.y + item.rect.height <= current.rect.y + 12 &&
                            current.rect.y - (item.rect.y + item.rect.height) <=
                                screen.height * 0.5
                        );
                    case "down":
                        return (
                            item.rect.y >= current.rect.y + current.rect.height - 12 &&
                            item.rect.y - (current.rect.y + current.rect.height) <=
                                screen.height * 0.5
                        );
                    case "left":
                        return (
                            item.rect.x + item.rect.width <= current.rect.x + 12 &&
                            current.rect.x - (item.rect.x + item.rect.width) <=
                                screen.width * 0.5
                        );
                    default:
                        return (
                            item.rect.x >= current.rect.x + current.rect.width - 12 &&
                            item.rect.x - (current.rect.x + current.rect.width) <=
                                screen.width * 0.5
                        );
                }
            });
            if (ahead.length) {
                const cross = direction === "left" || direction === "right";
                const curCross = cross
                    ? current.rect.y + current.rect.height / 2
                    : current.rect.x + current.rect.width / 2;
                let pick = ahead[0];
                let pickScore = Number.POSITIVE_INFINITY;
                ahead.forEach(item => {
                    const candCross = cross
                        ? item.rect.y + item.rect.height / 2
                        : item.rect.x + item.rect.width / 2;
                    const mainGap = cross
                        ? Math.abs(item.rect.x - current.rect.x)
                        : Math.abs(item.rect.y - current.rect.y);
                    const score = Math.abs(candCross - curCross) * 1.5 + mainGap * 0.2;
                    if (score < pickScore) {
                        pickScore = score;
                        pick = item;
                    }
                });
                this.setFocus(pick);
                return;
            }
        }
        if (!pool.length && direction === "up") {
            // 顶部工具条（返回/搜索/更多）往往在屏幕右上角，
            // 和下面内容区的 x 几乎不重叠，几何上"不属于上方候选"，
            // 结果就是光环永远走不到批量编辑那类按钮上。
            // 这里给 up 一个窄口子：整块都在当前元素上方的节点按"横向最近"挑一个。
            const above = scoped.filter(item => {
                if (item.rect.y + item.rect.height > current.rect.y + 12) {
                    return false;
                }
                if (!this.isOnScreen(item.rect)) {
                    return false;
                }
                const gap = current.rect.y - (item.rect.y + item.rect.height);
                return gap <= screen.height * 0.5;
            });
            if (above.length) {
                const curCx = current.rect.x + current.rect.width / 2;
                let pick = above[0];
                let pickScore = Number.POSITIVE_INFINITY;
                above.forEach(item => {
                    const cx = item.rect.x + item.rect.width / 2;
                    const score =
                        Math.abs(cx - curCx) * 1.5 +
                        Math.abs(current.rect.y - item.rect.y) * 0.2;
                    if (score < pickScore) {
                        pickScore = score;
                        pick = item;
                    }
                });
                this.setFocus(pick);
                return;
            }
        }
        if (!pool.length) {
            // 该方向上确实没有相邻元素：测量正常时保持焦点不动；
            // 测量大面积失败时改走顺序导航，避免"整页按键都像坏了"
            if (this.strictScope() && this.moveByOrder(direction, layer)) {
                return;
            }
            if (
                this.measurementBroken(layer, measured.length) &&
                this.moveByOrder(direction, layer)
            ) {
                return;
            }
            return;
        }

        // 可视区优先：屏幕里还有可见候选时，不要跳到屏幕外的元素上
        const onScreen = pool.filter(
            item => visibleRatio(item.rect, screen) > 0.15,
        );
        // 该方向上只剩屏幕外的候选时，仍然要往下走：
        // 这说明列表还有后续内容，选中后 setFocus 会让滚动容器把它带进画面。
        // 早先这里直接 return，导致"评论区按下行键永远没反应、
        // 歌单翻不到第二排"（用户反复反馈的问题）。
        const usable = onScreen.length ? onScreen : pool;
        // 太扁/太窄的节点（被滚动裁掉的残影、装饰条）不参与方向导航：
        // 它们一旦被选中，光环会画成一条细线，用户看到的是"按上键后
        // 原来的光环消失、上面也没有新光环"。
        const sized = usable.filter(
            item => item.rect.width >= 20 && item.rect.height >= 20,
        );
        const candidates = sized.length ? sized : usable;

        let best: IMeasuredNode | null = null;
        let bestScore = Number.POSITIVE_INFINITY;
        for (const item of candidates) {
            let value = this.score(current.rect, item.rect, direction);
            // 同一个列表里相邻的一项（order 相差 1）优先：列表上下移动应该一格一格走，
            // 而不是因为交叉轴偏移算错、先落到旁边的按钮或别的区域上。
            if (
                item.node.order != null &&
                current.node.order != null &&
                item.node.scope === current.node.scope &&
                Math.abs(item.node.order - current.node.order) === 1
            ) {
                value *= 0.55;
            }
            if (value < bestScore) {
                bestScore = value;
                best = item;
            }
        }
        if (best) {
            this.setFocus(best);
        }
    }

    /**
     * 顺序导航兜底：几何测量失效时（列表懒加载、面板动画中、被裁剪）
     * 按渲染顺序上下移动，保证"按到哪走到哪"，不会出现乱跳或不动。
     */

    /**
     * 测量是不是"大面积失败"：本页注册着不少可聚焦节点，却几乎测不到坐标。
     * 页面返回后（native-stack 刚把上一屏重新挂上）最常见，
     * 这时几何导航会完全瘫痪，必须退到顺序导航，否则按键看起来毫无反应。
     */
    private measurementBroken(layer: number, measuredCount: number): boolean {
        const registered = this.layerNodesOrdered(layer).filter(
            node =>
                this.focusListeners.has(node.id) &&
                this.nodeOfCurrentRoute(node),
        ).length;
        return registered >= 3 && measuredCount <= 2;
    }

    private moveByOrder(direction: Direction, layer: number): boolean {
        const sticky = this.strictNodes();
        const all = this.layerNodesOrdered(layer).filter(node =>
            this.focusListeners.has(node.id),
        );
        const own = all.filter(node => node.scope === this.currentScope);
        const same = all.filter(node => this.nodeOfCurrentRoute(node));
        const ordered = sticky.length
            ? sticky
            : own.length
              ? own
              : same.length
                ? same
                : all;
        if (!ordered.length) {
            return false;
        }
        const currentIndex = ordered.findIndex(node => node.id === this.focusedId);
        const step = direction === "up" || direction === "left" ? -1 : 1;
        // 不要循环：走到列表最后一行再按下行，旧实现会把光环送回页面第一个元素，
        // 用户看到的就是"按一下行键，焦点自己跳回上面"。到边界就停。
        const nextIndex = currentIndex < 0 ? 0 : currentIndex + step;
        if (nextIndex < 0 || nextIndex >= ordered.length) {
            return false;
        }
        if (nextIndex === currentIndex && ordered.length > 1) {
            return false;
        }
        this.focusNode(ordered[nextIndex]);
        return true;
    }

    private setFocus(measured: IMeasuredNode) {
        const previous = this.focusedId;
        if (previous === measured.node.id) {
            this.scrollIntoView(measured.rect);
            return;
        }
        this.focusedId = measured.node.id;
        this.focusedRect = measured.rect;
        if (previous != null) {
            this.notifyNodeFocus(previous);
        }
        this.notifyNodeFocus(measured.node.id);
        this.rememberFocus(measured.node.id);
        this.refreshRecentFocus(measured.node.id);
        this.emitRing();
        this.scrollIntoView(measured.rect);
        const layer = measured.node.layer ?? BASE_LAYER;
        this.layerFocusHistory.set(layer, measured.node.id);
        if (measured.node.debugName) {
            this.rememberFocusName(
                measured.node.debugName,
                measured.node.scope ?? 0,
            );
        }
        this.ensureFocusedVisible();
    }

    /**
     * 保险机制：焦点落到屏幕外的节点时（列表懒加载/滚动容器没跟上/rect 缓存过期），
     * 240ms 后重新量一次并再次滚动；仍然在屏幕外就退回屏幕内最近的节点，
     * 绝不允许"光环跑到画面外、画面不动"。
     */
    private ensureFocusedVisible() {
        const id = this.focusedId;
        if (id == null) {
            return;
        }
        // 同一个节点只保留一个检测定时器，避免播放页/列表快速切焦点时叠加
        if (this.visibleTimerId === id) {
            return;
        }
        this.visibleTimerId = id;
        setTimeout(() => {
            if (this.visibleTimerId === id) {
                this.visibleTimerId = null;
            }
            if (this.focusedId !== id) {
                return;
            }
            const node = this.nodes.get(id);
            if (!node) {
                return;
            }
            try {
                node.measure(rect => {
                    if (!rect || rect.width < 1 || rect.height < 1) {
                        return;
                    }
                    if (node.id !== this.focusedId) {
                        return;
                    }
                    this.focusedRect = rect;
                    rastCache.set(node.id, rect);
                    if (!this.isOnScreen(rect)) {
                        this.scrollIntoView(rect);
                        setTimeout(() => {
                            if (this.focusedId !== id) {
                                return;
                            }
                            this.pullFocusIntoView(id);
                        }, 320);
                    }
                });
            } catch {
                // ignore
            }
        }, 240);
    }

    private visibleTimerId: number | null = null;

    private isOnScreen(rect: TvRect) {
        const screen = screenRect();
        const cx = rect.x + rect.width / 2;
        const cy = rect.y + rect.height / 2;
        return (
            cx >= screen.x - 4 &&
            cx <= screen.x + screen.width + 4 &&
            cy >= screen.y - 4 &&
            cy <= screen.y + screen.height + 4
        );
    }

    /** 焦点仍在屏幕外时，退回到同图层里屏幕内、距离最近的节点 */
    private pullFocusIntoView(id: number): boolean {
        const node = this.nodes.get(id);
        const rect = this.focusedRect;
        if (!node || !rect) {
            return false;
        }
        if (this.isOnScreen(rect)) {
            return true;
        }
        const layer = node.layer ?? BASE_LAYER;
        let best: ITvFocusNode | null = null;
        let bestDistance = Number.POSITIVE_INFINITY;
        this.nodes.forEach(other => {
            if (other === node || other.disabled) {
                return;
            }
            if ((other.layer ?? BASE_LAYER) !== layer) {
                return;
            }

            const otherRect = rastCache.get(other.id);
            if (!otherRect || !this.isOnScreen(otherRect)) {
                return;
            }
            const dx = otherRect.x + otherRect.width / 2 - (rect.x + rect.width / 2);
            const dy = otherRect.y + otherRect.height / 2 - (rect.y + rect.height / 2);
            const distance = dx * dx + dy * dy;
            if (distance < bestDistance) {
                bestDistance = distance;
                best = other;
            }
        });
        if (best) {
            this.focusNode(best);
            return true;
        }
        return false;
    }

    private notifyNodeFocus(id: number) {
        const listeners = this.focusListeners.get(id);
        if (listeners) {
            listeners.forEach(listener => listener());
        }
    }

    /**
     * 节点被回收/卸载后，把光环接到离"上一个焦点位置"最近的那一个，
     * 而不是随便挑页面第一个（那正是"按着下键突然跳回第一行"的原因）。
     */
    private pickNearestToLastRect(pool: IMeasuredNode[]): IMeasuredNode | null {
        const last = this.lastFocusedRect;
        if (!last || !pool.length) {
            return null;
        }
        const lastCx = last.x + last.width / 2;
        const lastCy = last.y + last.height / 2;
        let bestBelow: IMeasuredNode | null = null;
        let bestBelowScore = Number.POSITIVE_INFINITY;
        let best: IMeasuredNode | null = null;
        let bestScore = Number.POSITIVE_INFINITY;
        for (const item of pool) {
            const cx = item.rect.x + item.rect.width / 2;
            const cy = item.rect.y + item.rect.height / 2;
            const score = Math.abs(cy - lastCy) * 2 + Math.abs(cx - lastCx);
            if (score < bestScore) {
                bestScore = score;
                best = item;
            }
            // 正在往下走的场景：优先接住"同一位置或更下面"的行
            const drift = cy - lastCy;
            if (drift > -last.height && drift < last.height * 6) {
                if (score < bestBelowScore) {
                    bestBelowScore = score;
                    bestBelow = item;
                }
            }
        }
        return bestBelow ?? best;
    }

    private suspended = false;

    private scheduleRefocus() {
        if (this.suspended) {
            return;
        }
        if (this.refocusTimer) {
            clearTimeout(this.refocusTimer);
        }
        this.refocusTimer = setTimeout(async () => {
            this.refocusTimer = null;
            const current =
                this.focusedId != null
                    ? this.nodes.get(this.focusedId)
                    : null;
            if (current) {
                return;
            }
            this.focusedId = null;
            this.focusedRect = null;
            const layer = this.activeLayer();
            const measured = await this.measureAll(layer);
            const pool = this.preferSameRoute(measured);
            const remembered = this.layerFocusHistory.get(layer);
            const restored =
                remembered != null
                    ? pool.find(item => item.node.id === remembered)
                    : null;
            let target =
                restored ??
                this.pickNearestToLastRect(pool) ??
                this.pickInitial(pool);
            if (!target) {
                // 测不到坐标（懒加载/面板动画/裁剪）时的兜底：
                // 直接把焦点给当前图层按渲染顺序的第一个可聚焦节点，
                // 这样"进去就有光环"，不需要按键试探。
                const all = this.layerNodesOrdered(layer);
                const same = all.filter(node => this.nodeOfCurrentRoute(node));
                const scoped = same.length ? same : all;
                const ordered = scoped.filter(node =>
                    this.focusListeners.has(node.id),
                );
                const first = ordered[0] ?? scoped[0];
                if (first) {
                    this.focusNode(first);
                    this.refocusRetry = 0;
                    return;
                }
            }
            if (target) {
                this.refocusRetry = 0;
                this.setFocus(target);
            } else if (this.refocusRetry < 6) {
                // 页面刚切换时元素还没完成布局（measure 返回 0），稍后重试，
                // 否则会出现"进去之后一个光环都没有、乱按方向键才偶尔落上"。
                this.refocusRetry += 1;
                this.scheduleRefocus();
            }
        }, 90);
    }

    private watchdogTimer: ReturnType<typeof setInterval> | null = null;

    /**
     * 焦点看门狗：页面/弹窗的元素往往比 refocus 更晚完成布局，
     * 一次性重试不够，会出现"进去之后一个光环都没有，要先按几下方向键才出现"。
     * 只要当前没有任何有效焦点，就持续（限次）重新聚焦。
     */
    startWatchdog() {
        if (this.watchdogTimer) {
            return;
        }
        this.watchdogTicks = 0;
        this.watchdogTimer = setInterval(() => {
            const current =
                this.focusedId != null ? this.nodes.get(this.focusedId) : null;
            if (current) {
                this.watchdogTicks = 0;
                return;
            }
            // 光环指向的节点已经不属于当前页面（或者压根不存在）：
            // 这是"进去了一个光环都没有、怎么按都没反应"的死锁状态，主动救回来
            if (this.focusedId != null) {
                this.focusedId = null;
                this.focusedRect = null;
                this.emitRing();
            }
            // 每次看门狗都重置重试计数，保证布局慢的页面（面板/弹层动画）
            // 也能在动画结束后落上焦点
            this.refocusRetry = 0;
            this.watchdogTicks += 1;
            if (this.watchdogTicks > 40) {
                // 长时间找不回焦点（页面空、或者全是不可测量节点）时，
                // 只做一次极轻量的"给本层第一个节点"，不再反复测量空转。
                // 绝不彻底放弃：否则页面一旦卡进无焦点状态就再也出不来，
                // 用户只能退出应用重进（实机反馈就是这样）。
                if (this.focusFirstInActiveLayer()) {
                    this.watchdogTicks = 0;
                }
                return;
            }
            this.scheduleRefocus();
        }, 500);
    }

    stopWatchdog() {
        if (this.watchdogTimer) {
            clearInterval(this.watchdogTimer);
            this.watchdogTimer = null;
        }
    }

    /** 主动聚焦一次（页面切换、列表刷新后调用） */
    refocus() {
        this.focusedId = null;
        this.scheduleRefocus();
    }

    /**
     * 全屏播放器（MV）用：悬停焦点系统，屏幕上不留光环。
     * 这些页面自己吃掉方向键/OK 键，不需要"焦点环"这套 UI。
     */
    suspendFocus() {
        this.suspended = true;
        this.focusedId = null;
        this.focusedRect = null;
        this.emitRing();
    }

    resumeFocus() {
        this.suspended = false;
        this.scheduleRefocus();
    }

    // ---------- 激活 ----------

    /**
     * 屏幕上是否真的有一个能看见的光环：
     * 焦点节点必须存在、属于当前页面、并且有组件在订阅（订阅了才画得出光环）。
     */
    hasVisibleFocus(): boolean {
        const node = this.getFocusedNode();
        if (!node || node.disabled) {
            return false;
        }
        return this.focusListeners.has(node.id);
    }

    getFocusedNode(): ITvFocusNode | null {
        if (this.focusedId == null) {
            return null;
        }
        return this.nodes.get(this.focusedId) ?? null;
    }

    press() {
        const node = this.getFocusedNode();
        // 只要能看见光环，就一定能按下。
        // 页面归属（scope）只用来决定"往哪走更合理"，绝不能当成能不能按的门槛 ——
        // 之前加了这层门槛，用户遇到的就是"光环明明在，按 OK 完全没反应"。
        if (node && !node.disabled) {
            // 按下的一刻就记下"当前停在哪"：用鼠标点开的弹框，
            // 关掉后也能把光环还给这个按钮，而不是掉到别的图标上
            if (node.debugName) {
                this.lastPageFocusName = node.debugName;
                this.scopeFocusName.set(node.scope ?? 0, node.debugName);
                // 用户是在这个元素上按 OK 进下一层的：返回时就应该回到它，
                // 不能靠"最后一次聚焦"的历史（那条历史会被下一层的控件覆盖）
                if (this.currentRoute) {
                    this.routeFocusName.set(this.currentRoute, node.debugName);
                    this.routeReturnName.set(this.currentRoute, node.debugName);
                }
            }
            node.onPress?.();
            return true;
        }
        // 光环丢了（节点跨页残留或已卸载）：这次 OK 先用来把光环找回来，
        // 否则用户会陷入"怎么点都没反应"的状态
        if (this.focusedId != null) {
            this.focusedId = null;
            this.focusedRect = null;
            this.emitRing();
        }
        if (!this.focusFirstInActiveLayer()) {
            this.scheduleRefocus();
        }
        return false;
    }

    beginLongPress() {
        this.longPressFired = false;
        const node = this.getFocusedNode();
        if (!node?.onLongPress) {
            return;
        }
        this.longPressTimer = setTimeout(() => {
            this.longPressTimer = null;
            this.longPressFired = true;
            node.onLongPress?.();
        }, 620);
    }

    endPress() {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
        if (this.longPressFired) {
            this.longPressFired = false;
            return false;
        }
        return this.press();
    }

    // ---------- 订阅 ----------

    subscribeRing(listener: () => void) {
        this.ringListeners.add(listener);
        return () => {
            this.ringListeners.delete(listener);
        };
    }

    private emitRing() {
        this.ringListeners.forEach(listener => listener());
    }

    subscribeNodeFocus(id: number, listener: () => void) {
        let set = this.focusListeners.get(id);
        if (!set) {
            set = new Set();
            this.focusListeners.set(id, set);
        }
        set.add(listener);
        if (this.focusedId === id) {
            try {
                listener();
            } catch {}
        }
        return () => {
            set?.delete(listener);
        };
    }

    isFocused(id: number) {
        return this.focusedId === id;
    }

    getFocusedRect() {
        return this.focusedRect;
    }

    /** 当前聚焦节点的 id（全局光环浮层用来重新测量） */
    getFocusedId() {
        return this.focusedId;
    }

    /** 重新测量当前聚焦节点并刷新 rect（滚动后坐标会变） */
    remeasureFocused() {
        const id = this.focusedId;
        if (id == null) {
            return;
        }
        const node = this.nodes.get(id);
        if (!node) {
            return;
        }
        try {
            node.measure(rect => {
                if (rect && rect.width > 0 && rect.height > 0) {
                    this.focusedRect = rect;
                    rastCache.set(id, rect);
                    this.emitRing();
                }
            });
        } catch {
            // ignore
        }
    }
}

export const tvFocus = new TvFocusStore();
