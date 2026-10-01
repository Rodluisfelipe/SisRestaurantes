package tech.menuby.sistema

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log

/**
 * El timbre de los pedidos nuevos, al 100 % siempre.
 *
 * Suena por el canal de ALARMA (como un despertador): se oye aunque el celular
 * esté en silencio o con el volumen de notificaciones bajo. Mientras suena, el
 * volumen de alarma se sube al máximo y al callar se deja como estaba.
 *
 * Lo piden varias fuentes a la vez (la llamada de cada oferta, la pantalla de
 * la app): cada una con su clave. Suena mientras quede alguna.
 */
object Timbre {
  private const val TAG = "MenuByTimbre"
  private val VIBRACION = longArrayOf(0, 900, 500, 900, 500)

  private val claves = mutableSetOf<String>()
  private val principal = Handler(Looper.getMainLooper())
  private var reproductor: MediaPlayer? = null
  private var vibrando = false
  private var volumenAntes: Int? = null
  private val vencimientos = mutableMapOf<String, Runnable>()
  private val callarLuego = Runnable { detener() }

  /** Empieza (o sigue) sonando por `clave`. `segundos`: se calla sola si nadie la suelta. */
  @Synchronized
  fun sonar(ctx: Context, clave: String, segundos: Long = 0, sonido: Boolean = true, vibrar: Boolean = true) {
    val app = ctx.applicationContext
    principal.removeCallbacks(callarLuego)
    claves.add(clave)
    vencimientos.remove(clave)?.let { principal.removeCallbacks(it) }
    if (segundos > 0) {
      val r = Runnable { soltar(app, clave) }
      vencimientos[clave] = r
      principal.postDelayed(r, segundos * 1000)
    }
    if (sonido && reproductor == null) arrancarSonido(app)
    if (vibrar && !vibrando) arrancarVibracion(app)
  }

  /** Esta fuente ya no necesita el timbre. Si no queda ninguna, se calla. */
  @Synchronized
  fun soltar(ctx: Context, clave: String) {
    claves.remove(clave)
    vencimientos.remove(clave)?.let { principal.removeCallbacks(it) }
    // Un respiro: si la pantalla de la app toma el timbre justo después, no se corta
    if (claves.isEmpty()) principal.postDelayed(callarLuego, 400)
  }

  @Synchronized
  fun callarTodo() {
    claves.clear()
    vencimientos.values.forEach { principal.removeCallbacks(it) }
    vencimientos.clear()
    detener()
  }

  @Synchronized
  private fun detener() {
    if (claves.isNotEmpty()) return
    try { reproductor?.stop() } catch (e: Exception) { /* ya parado */ }
    try { reproductor?.release() } catch (e: Exception) { /* nada */ }
    reproductor = null
    if (vibrando) {
      vibrador(contextoGuardado)?.cancel()
      vibrando = false
    }
    restaurarVolumen()
  }

  private var contextoGuardado: Context? = null

  private fun arrancarSonido(ctx: Context) {
    contextoGuardado = ctx
    try {
      val audio = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      if (volumenAntes == null) {
        volumenAntes = audio.getStreamVolume(AudioManager.STREAM_ALARM)
        audio.setStreamVolume(AudioManager.STREAM_ALARM, audio.getStreamMaxVolume(AudioManager.STREAM_ALARM), 0)
      }
      val mp = MediaPlayer()
      mp.setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
      )
      mp.setDataSource(ctx, Uri.parse("android.resource://${ctx.packageName}/raw/oferta"))
      mp.isLooping = true
      mp.setVolume(1f, 1f)
      mp.prepare()
      mp.start()
      reproductor = mp
    } catch (e: Exception) {
      Log.w(TAG, "No se pudo sonar: ${e.message}")
      reproductor = null
    }
  }

  private fun arrancarVibracion(ctx: Context) {
    contextoGuardado = ctx
    val v = vibrador(ctx) ?: return
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val attrs = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build()
        @Suppress("DEPRECATION")
        v.vibrate(VibrationEffect.createWaveform(VIBRACION, 0), attrs)
      } else {
        @Suppress("DEPRECATION")
        v.vibrate(VIBRACION, 0)
      }
      vibrando = true
    } catch (e: Exception) {
      Log.w(TAG, "No se pudo vibrar: ${e.message}")
    }
  }

  private fun vibrador(ctx: Context?): Vibrator? {
    ctx ?: return null
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      (ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      ctx.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    }
  }

  private fun restaurarVolumen() {
    val antes = volumenAntes ?: return
    volumenAntes = null
    try {
      val audio = contextoGuardado?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
      audio.setStreamVolume(AudioManager.STREAM_ALARM, antes, 0)
    } catch (e: Exception) { /* sin permiso para tocar el volumen: se queda */ }
  }
}
