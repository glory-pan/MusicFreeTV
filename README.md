# MusicFree TV

把 [MusicFree](https://github.com/maotoumao/MusicFree) 改造成**电视盒子 / TV 大屏**可用的音乐播放器：

- 原生按键桥（`TvRemoteModule`）：把遥控器的方向键、OK、菜单、返回、媒体键映射成 JS 事件
- JS 空间焦点引擎（`src/tv/`）：二维空间导航、焦点光环、列表自动滚动、Tab / 分页 / 首焦点策略
- 遥控器长按连发：按住方向键持续移动，松手即停
- 全屏 MV 播放：原生 TextureView + MediaPlayer，支持视频画面与独立音轨（可选视频原音 / 歌曲音轨）、倍速、快进快退
- 扫码输入：搜索、插件导入都可以用手机扫码完成，不用在电视上打字

界面全部按电视视距重新排布：播放页、搜索页、歌单 / 榜单 / 作者详情页、设置页、关于页都做了 TV 化。

## 版本信息

| 项 | 值 |
| --- | --- |
| 包名 | `fun.upup.musicfree` |
| versionName | `1.0.0` |
| 技术栈 | React Native 0.76.5 + Expo 52（`newArchEnabled=false`、`hermesEnabled=true`） |
| minSdk / targetSdk | 24 / 30（compileSdk 35） |
| 产物 | `universal` / `arm64-v8a` / `armeabi-v7a` 三个 Release APK |

## 自己编译

环境要求：JDK 17、Android SDK（build-tools 35）、Node 20+、以及项目依赖 `node_modules`。

```bash
# 1. 依赖
npm install

# 2. 导出 JS bundle（关闭压缩，便于排查）
npx expo export:embed --platform android --dev false \
  --entry-file index.js \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res

# 3. 编译 Hermes 字节码（启动快很多，避免盒子冷启动现场解析大体积 JS）
node_modules/react-native/sdks/hermesc/linux64-bin/hermesc -O -emit-binary \
  -out android/app/build/generated/assets/createBundleReleaseJsAndAssets/index.android.bundle \
  android/app/src/main/assets/index.android.bundle

# 4. 打包（跳过 gradle 自己的 bundle 任务，用上一步的 HBC）
SKIP_JS_BUNDLE=1 ./gradlew assembleRelease
```

产物在 `android/app/build/outputs/apk/release/`。

签名：仓库**不包含**签名密钥。自己打包前在 `android/app/build.gradle` 里配置你的 keystore，或直接用 debug 签名出包试装。

## 插件

本仓库不内置任何音源插件。装好后需要在 App 里「插件管理」手动导入插件 js（可在电视上扫码，或用 U 盘 / 局域网传文件），具体插件请自行寻找与甄别，注意遵守各平台的服务条款与当地法律。

本 App 只做播放器本体，不提供、不分发任何音源。

## 上游与许可

- 上游项目：[MusicFree](https://github.com/maotoumao/MusicFree)（作者 猫头猫）
- 本项目是对上游的 TV 化改造，遵循上游许可协议 **AGPL-3.0**，详见 `LICENSE`
- 上游 README 保留在 `readme.md`，上游变更记录在 `changelog.md`
- 本项目不收集任何用户数据；请支持正版音乐

## 免责声明

本项目仅供学习与技术交流使用，不得用于商业用途。使用过程中产生的任何版权问题与作者无关，请自行承担。
