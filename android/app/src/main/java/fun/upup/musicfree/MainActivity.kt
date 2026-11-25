package `fun`.upup.musicfree
import expo.modules.ReactActivityDelegateWrapper
import expo.modules.splashscreen.SplashScreenManager

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import android.content.pm.ActivityInfo
import android.os.Bundle
import android.view.KeyEvent
import android.view.WindowManager
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import `fun`.upup.musicfree.tv.TvRemoteModule

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "MusicFree"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      ReactActivityDelegateWrapper(this, BuildConfig.IS_NEW_ARCHITECTURE_ENABLED, DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled))

  // https://reactnavigation.org/docs/getting-started/#installing-dependencies-into-a-bare-react-native-project
  override fun onCreate(savedInstanceState: Bundle?) {
      SplashScreenManager.registerOnActivity(this)
      super.onCreate(null);
      // 电视盒子固定横屏
      requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
      // 播放音乐时保持屏幕常亮
      window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      // 全屏沉浸：隐藏状态栏与导航栏，避免电视上出现多余的边条
      WindowCompat.setDecorFitsSystemWindows(window, false)
      val controller = WindowInsetsControllerCompat(window, window.decorView)
      controller.hide(WindowInsetsCompat.Type.systemBars())
      controller.systemBarsBehavior =
          WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
  }

  /**
   * 把所有遥控器按键先交给 JS 侧的空间焦点引擎，未识别的按键（返回、音量等）继续走系统默认逻辑。
   */
  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
      if (TvRemoteModule.handleKeyEvent(event)) {
          return true
      }
      return super.dispatchKeyEvent(event)
  }
}
