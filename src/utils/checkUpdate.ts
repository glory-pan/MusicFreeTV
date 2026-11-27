import axios from "axios";
import DeviceInfo from "react-native-device-info";

/**
 * 更新检查：直接读本项目的 GitHub Releases。
 *
 * 版本号怎么比：这个仓库每次发版只递增 versionCode（1.0.0(100097) 这种），
 * versionName 一直是 1.0.0，所以拿 tag 里的 rNN 换算成 versionCode 与本地比，
 * 换算规则与构建脚本一致：versionCode = 99999 + rNN。
 */
const REPO = "glory-pan/MusicFreeTV";
const RELEASE_API = `https://api.github.com/repos/${REPO}/releases?per_page=10`;
const RELEASE_PAGE = `https://github.com/${REPO}/releases`;

interface IReleaseAsset {
    name: string;
    browser_download_url: string;
}

export interface IUpdateData {
    version: string;
    changeLog: string[];
    download: string[];
    /** 直接在软件内下载安装用的直链与文件名 */
    apkUrl?: string;
    apkName?: string;
    pageUrl?: string;
    versionCode?: number;
}

export interface IUpdateInfo {
    needUpdate: boolean;
    data: IUpdateData;
}

function codeFromTag(tag: string): number {
    const m = /-r(\d+)$/.exec(tag || "");
    return m ? 99999 + Number(m[1]) : 0;
}

function pickApk(assets: IReleaseAsset[]) {
    const apks = assets.filter(_ => /\.apk$/i.test(_.name));
    if (!apks.length) {
        return undefined;
    }
    const universal = apks.find(_ => /universal/i.test(_.name));
    if (universal) {
        return universal;
    }
    // 没有通用包就挑 arm64，TV 盒子绝大多数是 64 位
    return apks.find(_ => /arm64|v8a/i.test(_.name)) ?? apks[0];
}

export default async function checkUpdate(): Promise<IUpdateInfo | undefined> {
    const localCode = Number(DeviceInfo.getBuildNumber() ?? 0);
    try {
        const releases = (await axios.get(RELEASE_API, { timeout: 12000 })).data;
        if (!Array.isArray(releases) || !releases.length) {
            return undefined;
        }
        const latest = releases.find(
            (_: any) => !_.draft && !_.prerelease,
        );
        if (!latest) {
            return undefined;
        }
        const remoteCode = codeFromTag(String(latest.tag_name ?? ""));
        const apk = pickApk((latest.assets ?? []) as IReleaseAsset[]);
        const download: string[] = [];
        if (apk?.browser_download_url) {
            download.push(apk.browser_download_url);
        }
        const needUpdate = remoteCode
            ? remoteCode > localCode
            : /[0-9]/.test(String(latest.tag_name).replace(/\D+/g, ""));
        return {
            needUpdate,
            data: {
                version: String(latest.tag_name ?? latest.name ?? "新版本")
                    .replace(/^v/, ""),
                changeLog: String(latest.body ?? "")
                    .split("\n")
                    .map((_: string) => _.trim())
                    .filter((_: string) => !!_),
                download,
                apkUrl: apk?.browser_download_url,
                apkName: apk?.name,
                pageUrl: RELEASE_PAGE,
                versionCode: remoteCode || undefined,
            },
        };
    } catch {
        return undefined;
    }
}
