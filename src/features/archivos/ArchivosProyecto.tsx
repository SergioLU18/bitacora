import { Capacitor } from '@capacitor/core';
import { parseISO } from 'date-fns';
import {
  CloudUpload,
  Download,
  File,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Paperclip,
  Pencil,
  Plus,
  Trash,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState, type DragEvent, type FormEvent, type ReactNode } from 'react';
import { useSuscripcion } from '../../data/hooks/useSuscripcion';
import { useRepositorios } from '../../data/RepositoryContext';
import type { ContenidoArchivo } from '../../data/repositories/types';
import { useSincronizacion } from '../../data/sync/SincronizacionContext';
import { SEGUNDOS_ENLACE } from '../../data/sync/supabase';
import { TAMANO_MAXIMO_ARCHIVO, type Archivo } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { cn } from '../../lib/cn';
import { nombreDia } from '../../lib/fechas';
import { formatearTamano } from '../../lib/numeros';
import { Button, IconButton } from '../../ui/Button';
import { Input } from '../../ui/Campos';
import { Modal } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { EstadoVacio, ListaCargando } from '../../ui/Varios';

/** En la app de iOS los archivos se abren en Safari, que solo entiende enlaces de la nube. */
const NATIVO = Capacitor.isNativePlatform();

/** Se renuevan los enlaces de la nube antes de que caduquen. */
const MS_RENOVAR_ENLACE = (SEGUNDOS_ENLACE - 5 * 60) * 1000;

/**
 * Selector de archivos del proyecto: `elegir()` abre el del sistema y `subir()` guarda los que
 * lleguen por otra vía (arrastrar y soltar). `input` debe renderizarse una vez.
 */
export function useSubidaArchivos(proyectoId: string): {
  elegir: () => void;
  subir: (archivos: readonly globalThis.File[]) => Promise<void>;
  input: ReactNode;
} {
  const { archivos } = useRepositorios();
  const { mostrar } = useToast();
  const { t, locale } = useI18n();
  const ref = useRef<HTMLInputElement>(null);

  const subir = useCallback(
    async (elegidos: readonly globalThis.File[]) => {
      const grandes = elegidos.filter((f) => f.size > TAMANO_MAXIMO_ARCHIVO);
      if (grandes.length > 0) {
        mostrar({ mensaje: t.archivos.demasiadoGrande(grandes[0]!.name, formatearTamano(TAMANO_MAXIMO_ARCHIVO, locale)), tono: 'error' });
      }
      let guardados = 0;
      for (const archivo of elegidos) {
        if (archivo.size > TAMANO_MAXIMO_ARCHIVO) continue;
        try {
          await archivos.crear({ proyectoId, nombre: archivo.name, contenido: archivo });
          guardados++;
        } catch (error) {
          console.error(error);
          mostrar({ mensaje: t.errores.generico, tono: 'error' });
          return;
        }
      }
      if (guardados > 0 && grandes.length === 0) mostrar({ mensaje: t.archivos.guardado(guardados) });
    },
    [archivos, proyectoId, mostrar, t, locale],
  );

  const input = (
    <input
      ref={ref}
      type="file"
      multiple
      hidden
      onChange={(e) => {
        const elegidos = [...(e.target.files ?? [])];
        e.target.value = ''; // Permite volver a elegir el mismo archivo.
        void subir(elegidos);
      }}
    />
  );
  return { elegir: () => ref.current?.click(), subir, input };
}

interface Props {
  archivos: readonly Archivo[] | undefined;
  ahora: Date;
  elegir: () => void;
  subir: (archivos: readonly globalThis.File[]) => Promise<void>;
}

export function ArchivosProyecto({ archivos, ahora, elegir, subir }: Props) {
  const { t } = useI18n();
  const [arrastrando, setArrastrando] = useState(false);
  const [renombrando, setRenombrando] = useState<{ archivo?: Archivo; apertura: number }>({ apertura: 0 });

  const conArchivos = (e: DragEvent) => e.dataTransfer.types.includes('Files');
  const zona = {
    onDragOver: (e: DragEvent) => {
      if (!conArchivos(e)) return;
      e.preventDefault();
      setArrastrando(true);
    },
    onDragLeave: (e: DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setArrastrando(false);
    },
    onDrop: (e: DragEvent) => {
      if (!conArchivos(e)) return;
      e.preventDefault();
      setArrastrando(false);
      void subir([...e.dataTransfer.files]);
    },
  };

  if (!archivos) return <ListaCargando filas={3} />;

  return (
    <div {...zona} className="relative">
      {arrastrando && (
        <div className="pointer-events-none absolute -inset-2 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-acento bg-acento-suave/80 p-6 text-center text-[15px] font-medium text-acento">
          {t.archivos.soltar}
        </div>
      )}
      {archivos.length === 0 ? (
        <EstadoVacio
          icono={Paperclip}
          titulo={t.archivos.vacioTitulo}
          texto={NATIVO ? t.archivos.vacioTexto : `${t.archivos.vacioTexto} ${t.archivos.ayudaSoltar}`}
          accion={
            <Button variante="primario" icono={<Plus className="size-4" />} onClick={elegir}>
              {t.acciones.subirArchivo}
            </Button>
          }
        />
      ) : (
        <>
          <ul className="divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-superficie">
            {archivos.map((archivo) => (
              <FilaArchivo
                key={archivo.id}
                archivo={archivo}
                ahora={ahora}
                renombrar={() => setRenombrando((r) => ({ archivo, apertura: r.apertura + 1 }))}
              />
            ))}
          </ul>
          <button
            type="button"
            onClick={elegir}
            className="mt-3 flex h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-0.5 text-[15px] text-texto-2 transition-colors hover:text-acento md:h-10 md:text-sm"
          >
            <span className="flex size-[22px] items-center justify-center">
              <Plus className="size-[18px]" aria-hidden />
            </span>
            {t.acciones.subirArchivo}
          </button>
        </>
      )}
      <RenombrarModal
        key={`renombrar-${renombrando.apertura}`}
        archivo={renombrando.archivo}
        alCerrar={() => setRenombrando((r) => ({ ...r, archivo: undefined }))}
      />
    </div>
  );
}

type Aviso = 'subiendo' | 'soloAqui' | 'enOtroDispositivo';

/**
 * Cómo abrir un archivo: la copia del dispositivo si la hay (en el navegador) o un enlace
 * temporal de la nube. En iOS siempre la nube, porque se abre en Safari.
 */
function useEnlaceArchivo(archivo: Archivo): { href?: string; descargable: boolean; aviso?: Aviso; local?: string } {
  const { archivos } = useRepositorios();
  const { estado, servicio } = useSincronizacion();
  const conSesion = !!estado.correo;
  const contenido = useSuscripcion<ContenidoArchivo | undefined>(`contenido:${archivo.id}`, (ok, error) => archivos.observarContenido(archivo.id, ok, error));

  // Copia local como URL del navegador.
  const blob = contenido.datos?.contenido;
  const [local, setLocal] = useState<string>();
  useEffect(() => {
    if (!blob || NATIVO) return;
    const url = URL.createObjectURL(blob);
    setLocal(url);
    return () => {
      URL.revokeObjectURL(url);
      setLocal(undefined);
    };
  }, [blob]);

  // Enlace de la nube: en iOS siempre; en el navegador, solo si no hay copia local.
  const descargable = !NATIVO && !previsualizable(archivo);
  const necesitaNube = conSesion && contenido.estado === 'listo' && (NATIVO || !contenido.datos);
  const [nube, setNube] = useState<{ url?: string; listo: boolean }>({ listo: false });
  const [vuelta, setVuelta] = useState(0);
  useEffect(() => {
    const intervalo = setInterval(() => setVuelta((v) => v + 1), MS_RENOVAR_ENLACE);
    return () => clearInterval(intervalo);
  }, []);
  // Si aún no está en la nube, se reintenta tras cada sincronización.
  const reintento = nube.url ? `${vuelta}` : `${vuelta}:${estado.ultimaVez}:${contenido.datos?.enLaNube}`;
  useEffect(() => {
    if (!necesitaNube) return;
    let vigente = true;
    void servicio.enlaceArchivo(archivo, descargable).then((url) => vigente && setNube({ url, listo: true }));
    return () => {
      vigente = false;
    };
    // `archivo` entra por su id y nombre (el nombre de la descarga).
  }, [archivo.id, archivo.nombre, necesitaNube, descargable, reintento, servicio]);

  const href = NATIVO ? nube.url : (local ?? (necesitaNube ? nube.url : undefined));
  let aviso: Aviso | undefined;
  if (contenido.datos && !contenido.datos.enLaNube) aviso = conSesion ? 'subiendo' : 'soloAqui';
  else if (!contenido.datos && conSesion && nube.listo && !nube.url) aviso = 'enOtroDispositivo';
  return { href, descargable, aviso, local };
}

function FilaArchivo({ archivo, ahora, renombrar }: { archivo: Archivo; ahora: Date; renombrar: () => void }) {
  const { t, locale } = useI18n();
  const { archivos } = useRepositorios();
  const { servicio } = useSincronizacion();
  const { mostrar } = useToast();
  const { href, descargable, aviso, local } = useEnlaceArchivo(archivo);
  const Icono = iconoDe(archivo);

  const eliminar = async () => {
    try {
      await archivos.eliminar(archivo.id);
      mostrar({
        mensaje: t.archivos.eliminado,
        acciones: [{ texto: t.acciones.deshacer, alHacer: () => void archivos.restaurar(archivo.id) }],
      });
    } catch (error) {
      console.error(error);
      mostrar({ mensaje: t.errores.generico, tono: 'error' });
    }
  };

  // Descarga explícita (solo navegador): la copia local o un enlace de la nube que baja con su nombre.
  const descargar = async () => {
    const url = await servicio.enlaceArchivo(archivo, true);
    if (url) window.location.href = url;
    else mostrar({ mensaje: t.archivos.noDisponible, tono: 'error' });
  };

  const detalle = [
    extensionDe(archivo.nombre),
    formatearTamano(archivo.tamano, locale),
    t.archivos.agregado(nombreDia(parseISO(archivo.createdAt), ahora, t, locale)),
  ]
    .filter(Boolean)
    .join(' · ');

  const contenido = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-superficie-2 text-texto-2">
        <Icono className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium md:text-sm">{archivo.nombre}</span>
        <span className="block truncate text-[13px] text-texto-2 md:text-xs">{detalle}</span>
        {aviso && (
          <span className="mt-0.5 flex items-center gap-1 text-xs text-texto-3">
            {aviso === 'subiendo' && <CloudUpload className="size-3.5 shrink-0" aria-hidden />}
            <span className="truncate">{t.archivos[aviso]}</span>
          </span>
        )}
      </span>
    </>
  );
  const claseEnlace = 'flex min-w-0 flex-1 items-center gap-3 py-3 pr-2 pl-4 text-left';

  return (
    <li className="flex items-center">
      {href ? (
        <a
          href={href}
          target={descargable ? undefined : '_blank'}
          rel="noopener noreferrer"
          download={descargable ? archivo.nombre : undefined}
          className={cn(claseEnlace, 'transition-colors hover:text-acento')}
        >
          {contenido}
        </a>
      ) : (
        <button
          type="button"
          onClick={() => mostrar({ mensaje: aviso === 'soloAqui' ? t.archivos.soloAqui : t.archivos.noDisponible })}
          className={cn(claseEnlace, 'cursor-pointer')}
        >
          {contenido}
        </button>
      )}
      <div className="flex shrink-0 items-center gap-0.5 pr-2">
        {!NATIVO &&
          (local ? (
            <a
              href={local}
              download={archivo.nombre}
              aria-label={t.archivos.descargar}
              title={t.archivos.descargar}
              className="flex size-9 items-center justify-center rounded-lg text-texto-2 transition-colors hover:bg-superficie-2 hover:text-texto max-md:hidden"
            >
              <Download className="size-4" />
            </a>
          ) : (
            <IconButton etiqueta={t.archivos.descargar} onClick={() => void descargar()} className="max-md:hidden md:!size-9">
              <Download className="size-4" />
            </IconButton>
          ))}
        <IconButton etiqueta={t.archivos.renombrar} onClick={renombrar} className="md:!size-9">
          <Pencil className="size-4" />
        </IconButton>
        <IconButton etiqueta={t.acciones.eliminar} variante="peligro" onClick={() => void eliminar()} className="md:!size-9">
          <Trash className="size-4" />
        </IconButton>
      </div>
    </li>
  );
}

function RenombrarModal({ archivo, alCerrar }: { archivo: Archivo | undefined; alCerrar: () => void }) {
  const { t } = useI18n();
  const { archivos } = useRepositorios();
  const { mostrar } = useToast();
  const idForm = useId();
  const [nombre, setNombre] = useState(archivo?.nombre ?? '');

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!archivo || !nombre.trim()) return;
    try {
      if (nombre.trim() !== archivo.nombre) {
        await archivos.actualizar(archivo.id, { nombre });
        mostrar({ mensaje: t.archivos.renombrado });
      }
      alCerrar();
    } catch (error) {
      console.error(error);
      mostrar({ mensaje: t.errores.generico, tono: 'error' });
    }
  };

  return (
    <Modal
      abierto={!!archivo}
      alCerrar={alCerrar}
      titulo={t.archivos.renombrar}
      className="w-[min(420px,calc(100vw-32px))]"
      pie={
        <>
          <Button onClick={alCerrar}>{t.acciones.cancelar}</Button>
          <Button type="submit" form={idForm} variante="primario" disabled={!nombre.trim()}>
            {t.acciones.guardar}
          </Button>
        </>
      }
    >
      <form id={idForm} onSubmit={(e) => void guardar(e)}>
        <Input
          aria-label={t.archivos.nombre}
          data-autofocus
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onFocus={(e) => {
            // Selecciona el nombre sin la extensión, como el Finder.
            const punto = e.target.value.lastIndexOf('.');
            e.target.setSelectionRange(0, punto > 0 ? punto : e.target.value.length);
          }}
        />
      </form>
    </Modal>
  );
}

/** Tipos que el navegador muestra en una pestaña; el resto se descarga. */
function previsualizable(archivo: Archivo): boolean {
  const tipo = archivo.tipo ?? '';
  return tipo.startsWith('image/') || tipo === 'application/pdf' || tipo.startsWith('text/plain') || tipo.startsWith('video/');
}

function extensionDe(nombre: string): string | undefined {
  const punto = nombre.lastIndexOf('.');
  return punto > 0 && punto < nombre.length - 1 ? nombre.slice(punto + 1).toUpperCase() : undefined;
}

function iconoDe(archivo: Archivo): LucideIcon {
  const tipo = archivo.tipo ?? '';
  const extension = extensionDe(archivo.nombre)?.toLowerCase() ?? '';
  if (tipo.startsWith('image/')) return FileImage;
  if (/sheet|excel|csv/.test(tipo) || ['xls', 'xlsx', 'csv', 'numbers'].includes(extension)) return FileSpreadsheet;
  if (/zip|compressed|rar|7z/.test(tipo) || ['zip', 'rar', '7z'].includes(extension)) return FileArchive;
  if (tipo === 'application/pdf' || /word|document|text/.test(tipo) || ['pdf', 'doc', 'docx', 'pages', 'txt'].includes(extension)) {
    return FileText;
  }
  return File;
}
