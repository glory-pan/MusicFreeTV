import { NativeModules } from "react-native";

/**
 * 应用内更新（下载 + 调起系统安装器）的原生桥。
 * TV 盒子上通常没有浏览器，所以更新必须在软件里自己下载完再安装。
 */
const TvUpdater = NativeModules.TvUpdater;

export interface IUpdaterProgress {
    received: number;
    total: number;
    done: boolean;
    busy: boolean;
    error: string;
}

export const updaterAvailable = !!TvUpdater;

export function downloadApk(url: string, fileName: string): Promise<string> {
    return TvUpdater?.download(url, fileName);
}

export function getDownloadProgress(): Promise<IUpdaterProgress> {
    return TvUpdater?.getProgress();
}

export function canInstallApk(): Promise<boolean> {
    return TvUpdater?.canInstall();
}

export function openInstallPermission(): Promise<boolean> {
    return TvUpdater?.openInstallPermission();
}

export function installApk(path: string): Promise<boolean> {
    return TvUpdater?.install(path);
}
