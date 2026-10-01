/**
 * Entrada de la app. La tarea de GPS en segundo plano se registra ANTES que
 * las pantallas: expo-router las carga tarde, y si Android despierta la tarea
 * al abrir la app, tiene que encontrarla ya definida.
 */
import './src/lib/ubicacion';
import 'expo-router/entry';
