/**
 * 导航桥：TvProvider 挂在 NavigationContainer 之外（不能直接 useNavigate，
 * 否则启动即崩）。这里把容器内的 navigate 暴露成一个模块级函数，
 * 供按键/焦点这类"不在路由树里"的代码调用。
 */
type NavigateFn = (path: string) => void;

let navigateRef: NavigateFn | null = null;

export function setTvNavigate(fn: NavigateFn | null) {
    navigateRef = fn;
}

export function tvNavigate(path: string) {
    try {
        navigateRef?.(path);
    } catch {
        // 路由尚未就绪时忽略
    }
}
