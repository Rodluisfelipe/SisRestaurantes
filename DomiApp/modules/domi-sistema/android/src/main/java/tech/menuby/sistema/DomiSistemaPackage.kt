package tech.menuby.sistema

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener

/**
 * Engancha la pantalla principal de la app:
 *  - si se abrió desde una llamada de pedido, se muestra encima del bloqueo y
 *    prende la pantalla (sin esperar a que cargue JS);
 *  - avisa si la app está a la vista (para no timbrar dos veces).
 */
class DomiSistemaPackage : Package {
  override fun createReactActivityLifecycleListeners(activityContext: Context?): List<ReactActivityLifecycleListener> =
    listOf(CicloDeVida)
}

object CicloDeVida : ReactActivityLifecycleListener {
  override fun onCreate(activity: Activity, savedInstanceState: Bundle?) {
    revisar(activity, activity.intent)
  }

  override fun onNewIntent(intent: Intent?): Boolean {
    // La actividad ya existía (singleTask): la llamada llega aquí
    intent?.getStringExtra(Llamadas.EXTRA_CLAVE)?.let { clave ->
      Llamadas.pendiente = Bundle().apply {
        putString("clave", clave)
        putString("tipo", intent.getStringExtra(Llamadas.EXTRA_TIPO))
      }
      ultima?.get()?.let { sobreBloqueo(it, true) }
    }
    return false
  }

  override fun onResume(activity: Activity) {
    ultima = java.lang.ref.WeakReference(activity)
    Llamadas.actividadVisible = true
  }

  override fun onPause(activity: Activity) {
    Llamadas.actividadVisible = false
  }

  @Volatile private var ultima: java.lang.ref.WeakReference<Activity>? = null

  private fun revisar(activity: Activity, intent: Intent?) {
    ultima = java.lang.ref.WeakReference(activity)
    val clave = intent?.getStringExtra(Llamadas.EXTRA_CLAVE) ?: return
    Llamadas.pendiente = Bundle().apply {
      putString("clave", clave)
      putString("tipo", intent.getStringExtra(Llamadas.EXTRA_TIPO))
    }
    sobreBloqueo(activity, true)
  }

  fun sobreBloqueo(activity: Activity, activo: Boolean) {
    activity.runOnUiThread {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
        activity.setShowWhenLocked(activo)
        activity.setTurnScreenOn(activo)
      } else {
        @Suppress("DEPRECATION")
        val f = android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        if (activo) activity.window.addFlags(f) else activity.window.clearFlags(f)
      }
    }
  }
}
