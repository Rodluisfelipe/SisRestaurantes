package tech.menuby.sistema

import android.os.Bundle
import com.google.firebase.messaging.RemoteMessage
import expo.modules.notifications.service.ExpoFirebaseMessagingService

/**
 * Recibe los mensajes de Firebase antes que Expo (prioridad más alta en el
 * manifiesto). Los de pedidos ("llamada") los pinta como llamada; todo lo demás
 * sigue su camino normal por expo-notifications.
 */
class LlamadasService : ExpoFirebaseMessagingService() {
  override fun onMessageReceived(remoteMessage: RemoteMessage) {
    val datos = remoteMessage.data
    when (datos["llamada"]) {
      "oferta", "asignado" -> {
        val b = Bundle()
        datos.forEach { (k, v) -> b.putString(k, v) }
        b.putString("tipo", datos["llamada"])
        Llamadas.mostrar(applicationContext, b)
      }
      "colgar" -> {
        datos["clave"]?.let { Llamadas.cancelar(applicationContext, it) }
        Llamadas.alLlegar?.invoke(Bundle().apply { putString("tipo", "colgar"); putString("clave", datos["clave"]) })
      }
      else -> super.onMessageReceived(remoteMessage)
    }
  }
}
