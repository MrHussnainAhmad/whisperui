package com.hussnainahmadsahi.chat

import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.os.Build
import android.os.Bundle

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme);
    // Keep the tablet UI in landscape while phones remain unrestricted.
    if (isTablet()) requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
    // Whisper native window privacy
    window.addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE)
    if (android.os.Build.VERSION.SDK_INT >= 31) window.setHideOverlayWindows(true)
    if (android.os.Build.VERSION.SDK_INT >= 29) {
      (getSystemService(android.content.Context.AUDIO_SERVICE) as android.media.AudioManager)
        .setAllowedCapturePolicy(android.media.AudioAttributes.ALLOW_CAPTURE_BY_NONE)
    }
    super.onCreate(null)
  }

  private fun isTablet(): Boolean {
    val size = resources.configuration.screenLayout and Configuration.SCREENLAYOUT_SIZE_MASK
    return size >= Configuration.SCREENLAYOUT_SIZE_LARGE
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }

  // Discard obscured input; report evidence rather than scanning installed apps.
  private var lastPrivacyEventAt = 0L
  override fun dispatchTouchEvent(event: android.view.MotionEvent): Boolean {
    val obscured = (event.flags and android.view.MotionEvent.FLAG_WINDOW_IS_OBSCURED) != 0 ||
      (android.os.Build.VERSION.SDK_INT >= 29 &&
        (event.flags and android.view.MotionEvent.FLAG_WINDOW_IS_PARTIALLY_OBSCURED) != 0)
    if (obscured) {
      val now = android.os.SystemClock.elapsedRealtime()
      if (now - lastPrivacyEventAt > 1000L) {
        lastPrivacyEventAt = now
        val context = (application as com.facebook.react.ReactApplication).reactHost?.currentReactContext
        context?.getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          ?.emit("WhisperPrivacyViolation", "overlay")
      }
      return true
    }
    return super.dispatchTouchEvent(event)
  }
}
