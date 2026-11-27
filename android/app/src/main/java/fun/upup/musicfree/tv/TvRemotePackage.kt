package `fun`.upup.musicfree.tv

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class TvRemotePackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(
            TvRemoteModule(reactContext),
            TvQrServerModule(reactContext),
            TvEqualizerModule(reactContext),
            TvVideoModule(reactContext),
            TvUpdaterModule(reactContext),
        )

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        listOf(TvVideoViewManager())
}
