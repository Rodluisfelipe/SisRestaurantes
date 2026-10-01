/** Lo que manda el servidor (Backend/services/domiApp.js). */

export type Punto = { lat: number; lng: number };

export type EstadoPedido =
  | 'hacia_local'
  | 'en_local'
  | 'hacia_cliente'
  | 'con_cliente'
  | 'entregado'
  | 'no_entregado'
  | 'cancelado'
  | 'desconocido';

export type Negocio = {
  id: string;
  nombre: string;
  logo: string | null;
  telefono: string | null;
  direccion: string;
  ubicacion: Punto | null;
  color: string | null;
  /** En un envío: la empresa de reparto que lo manda */
  empresa?: string | null;
  /** Fotos de la fachada, para encontrar el local */
  fotos?: string[];
};

export type Pedido = {
  id: string;
  /** 'envio': un envío de una empresa de reparto a sus propios clientes */
  tipo?: 'envio';
  numero: number | string;
  driverId: string | null;
  estado: EstadoPedido;
  negocio: Negocio | null;
  cliente: {
    nombre: string;
    telefono: string | null;
    direccion: string;
    notas: string;
    ubicacion: Punto | null;
  };
  productos: { nombre: string; cantidad: number; notas: string; extras: string[] }[];
  total: number;
  domicilio: number;
  metodoPago: string | null;
  efectivo: number;
  ganancia: number;
  /** Red MenuBy: cómo se armó lo que gana (tarifa congelada) */
  desgloseGanancia?: { concepto: string; valor: number }[] | null;
  distanciaKm: number | null;
  pideCodigoEntrega: boolean;
  pideCodigoRecogida: boolean;
  asignadoAt: string | null;
  /** Lo aceptó solo (aceptación automática) */
  automatico?: boolean;
  marcas: { llegoLocal: string | null; recogido: string | null; llegoCliente: string | null; entregado: string | null };
  listoEnLocal: boolean;
};

export type Oferta = {
  id: string;
  venceAt: string;
  segundos: number;
  kmAlLocal: number | null;
  pedido: Pedido;
};

export type Cuadre = {
  businessId: string;
  negocio: string;
  entregas: number;
  efectivo: number;
  ganancias: number;
  neto: number;
  debeEntregar: number;
  leDeben: number;
  detalle: {
    orderId: string;
    numero: number | string;
    negocio: string;
    cliente: string;
    entregadoAt: string;
    efectivo: number;
    ganancia: number;
    metodoPago: string | null;
  }[];
};

export type Afiliacion = {
  id: string;
  tipo: 'negocio' | 'empresa' | 'red';
  nombre: string;
  detalle?: string;
  negocios?: number;
  logo: string | null;
  maxActivos: number;
};

export type EstadoServidor = {
  cuenta: {
    nombre: string;
    telefono: string;
    foto: string | null;
    calificacion: number;
    enLinea: boolean;
    totalEntregas: number;
    /** Nivel MenuBy Go (Go → MenuBy Black) */
    nivel?: { id: number; nombre: string };
    /** Tiene activa la aceptación automática */
    autoAcepta?: boolean;
  };
  afiliaciones: Afiliacion[];
  pedidos: Pedido[];
  ofertas: Oferta[];
  hoy: { entregas: number; ganancias: number };
  efectivoEnMano: number;
  cuadres: Cuadre[];
  servidorAt: string;
};

export type TipoEvento = 'llegue_local' | 'recogido' | 'llegue_cliente' | 'entregado' | 'no_entregado';

export type Evento = {
  id: string;
  tipo: TipoEvento;
  pedidoId: string;
  at: string;
  lat?: number;
  lng?: number;
  datos?: { codigo?: string; motivo?: string; nota?: string; fotoUrl?: string };
};

export type ResultadoEvento = {
  id: string;
  pedidoId?: string;
  tipo?: TipoEvento;
  ok: boolean;
  error?: string;
  estado?: EstadoPedido;
  yaEstaba?: boolean;
  repetido?: boolean;
  definitivo?: boolean;
  intentosRestantes?: number;
  /** Con "lejos_del_cliente": a cuántos metros de la dirección estaba */
  metros?: number;
};

/* ── Nivel, desempeño, aceptación automática y beneficios ── */

export type Desempeno = {
  nivel: {
    id: number; nombre: string; beneficio: string; desde: string | null; protegidoHasta: string | null;
    enRiesgo: boolean; paraMantener: string[]; revisionAt: string | null;
  };
  siguiente: { id: number; nombre: string; beneficio: string; faltante: string[] } | null;
  niveles: {
    id: number; nombre: string; beneficio: string; logrado: boolean;
    requisitos: { entregas: number; cumplimiento: number; puntualidad: number | null; calificacion: number | null } | null;
  }[];
  metricas: { entregas: number; faltas: number; cumplimiento: number; puntualidad: number; calificacion: number };
  faltas: {
    id: string; tipo: string; motivo: string; at: string; pedido: string | null; negocio: string | null;
    estado: 'vigente' | 'en_revision' | 'anulada'; reclamo: { nota: string; respuesta: string | null } | null;
  }[];
};

export type AutoAcepta = {
  disponible: boolean; nivelNecesario: string; activo: boolean; kmMax: number; gananciaMin: number;
  maxPedidos: number; maxActivos: number; apagadaPor: 'nivel' | 'no_arranco' | null;
};

export type Beneficios = {
  codigo: string;
  correo: string | null;
  beneficios: {
    id: string; titulo: string; descripcion: string; enlace: string; imagen: string | null;
    canje: { estado: 'pendiente' | 'confirmado'; comprobante?: string; at: string } | null;
  }[];
};
