/**
 * El enemigo número uno de una app de domicilios: el ahorro de batería.
 *
 * Xiaomi, Redmi, Huawei, Oppo, Vivo y varios Samsung cierran las apps en
 * segundo plano aunque tengan su notificación fija, y el domi deja de recibir
 * pedidos sin saber por qué. Aquí se detecta si el celular la está
 * restringiendo y se le dice, con los pasos de SU marca, cómo quitarlo.
 */
import * as Battery from 'expo-battery';
import * as Device from 'expo-device';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Application from 'expo-application';
import { Linking } from 'react-native';

export async function bateriaRestringida(): Promise<boolean> {
  try {
    return await Battery.isBatteryOptimizationEnabledAsync();
  } catch {
    return false;
  }
}

const paquete = () => `package:${Application.applicationId || 'tech.menuby.domiapp'}`;

export async function abrirAjusteBateria() {
  try {
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
  } catch {
    await abrirAjustesApp();
  }
}

export async function abrirAjustesApp() {
  try {
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS, { data: paquete() });
  } catch {
    Linking.openSettings();
  }
}

export async function abrirAjustesUbicacion() {
  try {
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.LOCATION_SOURCE_SETTINGS);
  } catch {
    Linking.openSettings();
  }
}

/** Xiaomi, Redmi y POCO: tienen su propio ahorro de batería, que Android no ve. */
export const esXiaomi = /xiaomi|redmi|poco/i.test(Device.manufacturer || '');

/** Pasos extra según la marca (lo de "Sin restricciones" no basta en estas). */
export function pasosDeMarca(): { marca: string; pasos: string[] } | null {
  const m = (Device.manufacturer || '').toLowerCase();
  if (m.includes('xiaomi') || m.includes('redmi') || m.includes('poco')) {
    return {
      marca: 'Xiaomi / Redmi / POCO',
      pasos: [
        'Abre Ajustes → Aplicaciones → MenuBy Go.',
        'Toca "Ahorro de batería" y elige "Sin restricciones".',
        'Activa "Inicio automático".',
        'En "Otros permisos", activa "Mostrar ventanas emergentes mientras se ejecuta en segundo plano" y "Mostrar en pantalla de bloqueo": sin eso la app no se abre sola cuando cae un pedido.',
        'En la pantalla de apps recientes, deja presionada MenuBy Go y toca el candado.',
      ],
    };
  }
  if (m.includes('samsung')) {
    return {
      marca: 'Samsung',
      pasos: [
        'Abre Ajustes → Batería → Límites de uso en segundo plano.',
        'Quita MenuBy Go de "Aplicaciones en suspensión" y "en suspensión profunda".',
        'Agrégala a "Aplicaciones que nunca se suspenden".',
      ],
    };
  }
  if (m.includes('huawei') || m.includes('honor')) {
    return {
      marca: 'Huawei / Honor',
      pasos: [
        'Abre Ajustes → Batería → Inicio de aplicaciones.',
        'Busca MenuBy Go, desactiva "Gestionar automáticamente".',
        'Deja activadas las tres opciones: inicio automático, inicio secundario y ejecutar en segundo plano.',
      ],
    };
  }
  if (m.includes('oppo') || m.includes('realme') || m.includes('oneplus')) {
    return {
      marca: m.includes('realme') ? 'Realme' : m.includes('oneplus') ? 'OnePlus' : 'Oppo',
      pasos: [
        'Abre Ajustes → Batería → Uso de batería de las apps.',
        'Busca MenuBy Go y permite "Actividad en segundo plano" e "Inicio automático".',
      ],
    };
  }
  if (m.includes('vivo')) {
    return {
      marca: 'Vivo',
      pasos: [
        'Abre Ajustes → Batería → Consumo alto en segundo plano.',
        'Activa MenuBy Go.',
        'En i Manager → Administrador de apps → Inicio automático, actívala.',
      ],
    };
  }
  if (m.includes('motorola')) {
    return {
      marca: 'Motorola',
      pasos: ['Abre Ajustes → Batería → Optimización → MenuBy Go → "Sin optimizar".'],
    };
  }
  return null;
}
