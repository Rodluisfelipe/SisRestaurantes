package tech.menuby.sistema

import android.app.KeyguardManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

/**
 * Las ofertas y los pedidos asignados llegan como una LLAMADA entrante.
 *
 * Es lo que hacen las apps de domicilios grandes: el aviso entra por el canal
 * de alta prioridad de Firebase (que las marcas no cortan como cortan los
 * sockets en segundo plano) y lo pinta Android, no la app. Así no depende de
 * que la app esté despierta:
 *  - con la pantalla apagada o bloqueada, la notificación de pantalla completa
 *    la prende y abre la app encima del bloqueo;
 *  - con el celular en uso, sale arriba como una llamada;
 *  - suena en bucle (FLAG_INSISTENT) y vibra hasta que el domi la atiende o
 *    vence la oferta (setTimeoutAfter).
 *
 * Cuando la app ya muestra la oferta en pantalla, la cancela (ver JS): el
 * timbre lo toma la pantalla de la app y no suenan dos.
 */
object Llamadas {
  private const val TAG = "MenuByLlamadas"

  /** Versión en el id: los canales de Android no se pueden cambiar una vez creados. */
  const val CANAL = "llamadas-pedidos-v1"
  /** Para cuando la app ya está a la vista: aviso sin timbre (lo pone la pantalla de la app). */
  const val CANAL_SILENCIO = "llamadas-pedidos-silencio-v1"

  const val EXTRA_CLAVE = "menubyLlamada"
  const val EXTRA_TIPO = "menubyLlamadaTipo"

  /** La llamada con la que se abrió la app (la lee JS al arrancar). */
  @Volatile var pendiente: Bundle? = null

  /** ¿La pantalla de la app está a la vista? (lo marca el ciclo de vida de la actividad) */
  @Volatile var actividadVisible = false

  /** JS escucha aquí si está vivo (para refrescar al instante). */
  @Volatile var alLlegar: ((Bundle) -> Unit)? = null

  private val VIBRACION = longArrayOf(0, 900, 500, 900, 500, 900, 500)

  fun idDe(clave: String): Int = 0x4D000000 or (clave.hashCode() and 0x00FFFFFF)

  fun crearCanales(ctx: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
    if (nm.getNotificationChannel(CANAL) == null) {
      val sonido = Uri.parse("android.resource://${ctx.packageName}/raw/oferta")
      val audio = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()
      nm.createNotificationChannel(NotificationChannel(CANAL, "Pedidos nuevos (como llamada)", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Suena como una llamada cuando te ofrecen o te asignan un pedido"
        setSound(sonido, audio)
        enableVibration(true)
        vibrationPattern = VIBRACION
        lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
        setBypassDnd(true)
        setShowBadge(true)
      })
    }
    if (nm.getNotificationChannel(CANAL_SILENCIO) == null) {
      nm.createNotificationChannel(NotificationChannel(CANAL_SILENCIO, "Pedidos nuevos (app abierta)", NotificationManager.IMPORTANCE_LOW).apply {
        description = "Cuando la app ya está a la vista, el aviso no suena: suena la pantalla de la oferta"
        setSound(null, null)
        enableVibration(false)
      })
    }
  }

  /** Android 14+: el permiso de "notificaciones en pantalla completa" (antes venía dado). */
  fun puedePantallaCompleta(ctx: Context): Boolean {
    if (Build.VERSION.SDK_INT < 34) return true
    return try {
      ctx.getSystemService(NotificationManager::class.java)?.canUseFullScreenIntent() ?: true
    } catch (e: Exception) {
      true
    }
  }

  fun abrirPermisoPantallaCompleta(ctx: Context) {
    if (Build.VERSION.SDK_INT < 34) return
    val intent = Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:${ctx.packageName}"))
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    try {
      ctx.startActivity(intent)
    } catch (e: Exception) {
      ctx.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${ctx.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }

  private fun intentDeApertura(ctx: Context, datos: Bundle): Intent? {
    val intent = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName) ?: return null
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
    intent.putExtra(EXTRA_CLAVE, datos.getString("clave"))
    intent.putExtra(EXTRA_TIPO, datos.getString("tipo"))
    return intent
  }

  private fun icono(ctx: Context): Int {
    return try {
      val meta = ctx.packageManager.getApplicationInfo(ctx.packageName, PackageManager.GET_META_DATA).metaData
      val propio = meta?.getInt("expo.modules.notifications.default_notification_icon", 0) ?: 0
      if (propio != 0) propio else ctx.applicationInfo.icon
    } catch (e: Exception) {
      ctx.applicationInfo.icon
    }
  }

  private fun pantallaEnUso(ctx: Context): Boolean {
    val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
    val km = ctx.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
    return pm.isInteractive && !km.isKeyguardLocked
  }

  /**
   * Muestra la llamada. `datos`: clave (id estable de la oferta/pedido), tipo
   * (oferta | asignado), titulo, cuerpo, venceEnSeg.
   */
  fun mostrar(ctx: Context, datos: Bundle) {
    val clave = datos.getString("clave") ?: return
    try {
      crearCanales(ctx)
      val abrir = intentDeApertura(ctx, datos) ?: return
      val pi = PendingIntent.getActivity(
        ctx, idDe(clave), abrir, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      val aLaVista = actividadVisible && pantallaEnUso(ctx)
      val vence = (datos.getString("venceEnSeg")?.toLongOrNull() ?: 120L).coerceIn(10L, 600L)

      val b = NotificationCompat.Builder(ctx, if (aLaVista) CANAL_SILENCIO else CANAL)
        .setSmallIcon(icono(ctx))
        .setColor(0xFFD30310.toInt())
        .setContentTitle(datos.getString("titulo") ?: "Nuevo pedido")
        .setContentText(datos.getString("cuerpo") ?: "Toca para verlo")
        .setStyle(NotificationCompat.BigTextStyle().bigText(datos.getString("cuerpo") ?: "Toca para verlo"))
        .setCategory(NotificationCompat.CATEGORY_CALL)
        .setPriority(if (aLaVista) NotificationCompat.PRIORITY_LOW else NotificationCompat.PRIORITY_MAX)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setContentIntent(pi)
        .setAutoCancel(true)
        .setOngoing(!aLaVista)
        .setTimeoutAfter(vence * 1000)
      if (!aLaVista) {
        b.setFullScreenIntent(pi, true)
        b.setVibrate(VIBRACION)
      }
      val n = b.build()
      if (!aLaVista) n.flags = n.flags or android.app.Notification.FLAG_INSISTENT

      if (androidx.core.content.ContextCompat.checkSelfPermission(ctx, android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        || Build.VERSION.SDK_INT < 33) {
        NotificationManagerCompat.from(ctx).notify(idDe(clave), n)
      }

      if (!aLaVista) {
        // Prender la pantalla aunque la marca ignore la pantalla completa
        despertarPantalla(ctx)
        // Celular en uso y con "mostrar sobre otras apps": abrirse encima de lo que esté usando
        if (pantallaEnUso(ctx) && Settings.canDrawOverlays(ctx)) {
          try { ctx.startActivity(abrir) } catch (e: Exception) { Log.w(TAG, "No se pudo abrir encima: ${e.message}") }
        }
      }
    } catch (e: Exception) {
      Log.e(TAG, "No se pudo mostrar la llamada", e)
    }
    alLlegar?.invoke(datos)
  }

  private fun despertarPantalla(ctx: Context) {
    try {
      val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
      if (pm.isInteractive) return
      @Suppress("DEPRECATION")
      val wl = pm.newWakeLock(
        PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
        "menuby:llamada"
      )
      wl.acquire(10_000)
    } catch (e: Exception) {
      Log.w(TAG, "No se pudo prender la pantalla: ${e.message}")
    }
  }

  fun cancelar(ctx: Context, clave: String) {
    NotificationManagerCompat.from(ctx).cancel(idDe(clave))
  }

  fun cancelarTodas(ctx: Context) {
    val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      nm.activeNotifications.filter { (it.id and 0xFF000000.toInt()) == 0x4D000000 }.forEach { nm.cancel(it.id) }
    }
  }
}
