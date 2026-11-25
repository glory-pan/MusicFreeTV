import { NativeModules } from "react-native";

const qrNative = NativeModules.TvQrServer;
const eqNative = NativeModules.TvEqualizer;
const videoNative = NativeModules.TvVideo;

export interface IQrServerInfo {
    ip: string;
    port: number;
    token: string;
    textUrl: string;
    pluginUrl: string;
    linkUrl?: string;
}

export type TPendingPlugin = {
    type: "file" | "url";
    value: string;
};

/** 手机扫码输入（电视上打字太痛苦，扫码后手机上输入再回传） */
export const tvQrServer = {
    available: !!qrNative,
    start(): Promise<IQrServerInfo | null> {
        return qrNative ? qrNative.start() : Promise.resolve(null);
    },
    stop(): Promise<boolean> {
        return qrNative ? qrNative.stop() : Promise.resolve(false);
    },
    getInfo(): Promise<IQrServerInfo | null> {
        return qrNative ? qrNative.getInfo() : Promise.resolve(null);
    },
    pollText(): Promise<string | null> {
        return qrNative ? qrNative.pollText() : Promise.resolve(null);
    },
    pollPlugin(): Promise<TPendingPlugin | null> {
        return qrNative ? qrNative.pollPlugin() : Promise.resolve(null);
    },
};

export interface IEqBand {
    index: number;
    center: number;
    level: number;
}

export interface IEqPreset {
    index: number;
    name: string;
}

export interface IEqState {
    supported: boolean;
    enabled: boolean;
    minLevel: number;
    maxLevel: number;
    bands: IEqBand[];
    presets: IEqPreset[];
}

export const tvEqualizer = {
    available: !!eqNative,
    getState(): Promise<IEqState | null> {
        return eqNative ? eqNative.getState() : Promise.resolve(null);
    },
    setEnabled(enabled: boolean): Promise<boolean> {
        return eqNative ? eqNative.setEnabled(enabled) : Promise.resolve(false);
    },
    setBandLevel(index: number, level: number): Promise<boolean> {
        return eqNative
            ? eqNative.setBandLevel(index, level)
            : Promise.resolve(false);
    },
    setPreset(index: number): Promise<boolean> {
        return eqNative ? eqNative.setPreset(index) : Promise.resolve(false);
    },
};

export interface IVideoStatus {
    ready: boolean;
    position: number;
    duration: number;
    playing: boolean;
    error?: string | null;
}

export const tvVideo = {
    available: !!videoNative,
    play(): Promise<boolean> {
        return videoNative ? videoNative.play() : Promise.resolve(false);
    },
    pause(): Promise<boolean> {
        return videoNative ? videoNative.pause() : Promise.resolve(false);
    },
    seekTo(position: number): Promise<boolean> {
        return videoNative ? videoNative.seekTo(position) : Promise.resolve(false);
    },
    setSpeed(speed: number): Promise<boolean> {
        return videoNative
            ? videoNative.setSpeed(speed)
            : Promise.resolve(false);
    },
    stop(): Promise<boolean> {
        return videoNative ? videoNative.stop() : Promise.resolve(false);
    },
    getStatus(): Promise<IVideoStatus> {
        return videoNative
            ? videoNative.getStatus()
            : Promise.resolve({ ready: false, position: 0, duration: 0, playing: false });
    },
    // ===== MV 配乐（独立原生播放器）=====
    // 视频流带不带音轨我们救不了，于是把“声音”交给一个独立的原生播放器，
    // 它和 App 内的歌曲播放器互不干扰，不会被抢焦点暂停
    setMvAudio(
        url: string,
        headers?: Record<string, string>,
    ): Promise<boolean> {
        return videoNative
            ? videoNative.setMvAudio(url, headers ?? {})
            : Promise.resolve(false);
    },
    mvAudioPlay(): Promise<boolean> {
        return videoNative ? videoNative.mvAudioPlay() : Promise.resolve(false);
    },
    mvAudioPause(): Promise<boolean> {
        return videoNative ? videoNative.mvAudioPause() : Promise.resolve(false);
    },
    mvAudioSpeed(speed: number): Promise<boolean> {
        return videoNative ? videoNative.mvAudioSpeed(speed) : Promise.resolve(false);
    },
    mvAudioSeek(position: number): Promise<boolean> {
        return videoNative ? videoNative.mvAudioSeek(position) : Promise.resolve(false);
    },
    mvAudioStop(): Promise<boolean> {
        return videoNative ? videoNative.mvAudioStop() : Promise.resolve(false);
    },
    getMvAudioStatus(): Promise<{ ready: boolean; position: number; duration: number; playing: boolean }> {
        return videoNative
            ? videoNative.getMvAudioStatus()
            : Promise.resolve({ ready: false, position: 0, duration: 0, playing: false });
    },
};
