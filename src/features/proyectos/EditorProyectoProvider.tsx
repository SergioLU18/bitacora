import { parseISO } from 'date-fns';
import { Check } from 'lucide-react';
import { createContext, useCallback, useContext, useId, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useRepositorios } from '../../data/RepositoryContext';
import { COLORES_PROYECTO, COLOR_PROYECTO_POR_DEFECTO } from '../../domain/colores';
import { ESTADOS_PROYECTO, type EstadoProyecto, type Proyecto } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { cn } from '../../lib/cn';
import { Button } from '../../ui/Button';
import { Campo, Input, Segmentado, Textarea } from '../../ui/Campos';
import { finDelDia, inicioDelDia, valorDia } from '../../lib/fechas';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { CamposEntrega, type ValoresEntrega } from './CamposEntrega';

interface ContextoEditorProyecto {
  nuevoProyecto: () => void;
  editarProyecto: (proyecto: Proyecto) => void;
}

const EditorProyectoContext = createContext<ContextoEditorProyecto | null>(null);

export function EditorProyectoProvider({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const [proyecto, setProyecto] = useState<Proyecto | undefined>();
  const [apertura, setApertura] = useState(0);

  const abrir = useCallback((p?: Proyecto) => {
    setProyecto(p);
    setApertura((n) => n + 1);
    setAbierto(true);
  }, []);

  const valor = useMemo(
    () => ({ nuevoProyecto: () => abrir(), editarProyecto: (p: Proyecto) => abrir(p) }),
    [abrir],
  );

  return (
    <EditorProyectoContext.Provider value={valor}>
      {children}
      <ProyectoSheet key={apertura} abierto={abierto} original={proyecto} alCerrar={() => setAbierto(false)} />
    </EditorProyectoContext.Provider>
  );
}

export function useEditorProyecto(): ContextoEditorProyecto {
  const contexto = useContext(EditorProyectoContext);
  if (!contexto) throw new Error('useEditorProyecto debe usarse dentro de <EditorProyectoProvider>');
  return contexto;
}

function ProyectoSheet({ abierto, original, alCerrar }: { abierto: boolean; original?: Proyecto; alCerrar: () => void }) {
  const { t } = useI18n();
  const { proyectos } = useRepositorios();
  const { mostrar } = useToast();
  const navegar = useNavigate();
  const idForm = useId();
  const idNombre = useId();
  const idDescripcion = useId();
  const idCliente = useId();

  const [nombre, setNombre] = useState(original?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(original?.descripcion ?? '');
  const [cliente, setCliente] = useState(original?.cliente ?? '');
  const [color, setColor] = useState(original?.color ?? COLOR_PROYECTO_POR_DEFECTO);
  const [estado, setEstado] = useState<EstadoProyecto>(original?.estado ?? 'activo');
  const dia = (iso: string | undefined) => (iso ? valorDia(parseISO(iso)) : '');
  const [entrega, setEntrega] = useState<ValoresEntrega>({
    inicio: dia(original ? (original.inicio ?? original.createdAt) : new Date().toISOString()),
    entrega: dia(original?.entregaEstimada),
    entregado: dia(original?.entregadoEn),
    reiniciarOriginal: false,
    sugerenciaUsada: false,
  });
  const [guardando, setGuardando] = useState(false);

  const guardar = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!nombre.trim() || guardando) return;
    setGuardando(true);
    try {
      const inicio = inicioDelDia(entrega.inicio);
      const entregaEstimada = entrega.entrega ? finDelDia(entrega.entrega) : undefined;
      if (original) {
        // Si no se tocaron, las fechas guardadas se conservan con su hora exacta.
        const sinCambio = (iso: string | undefined, valor: string) => dia(iso) === valor;
        await proyectos.actualizar(original.id, {
          nombre,
          descripcion: descripcion || null,
          cliente: cliente || null,
          color,
          estado,
          ...(!sinCambio(original.inicio ?? original.createdAt, entrega.inicio) && { inicio: inicio ?? null }),
          ...(!sinCambio(original.entregaEstimada, entrega.entrega) && { entregaEstimada: entregaEstimada ?? null }),
          ...(entrega.reiniciarOriginal && { entregaEstimadaInicial: entregaEstimada ?? null }),
          ...(!sinCambio(original.entregadoEn, entrega.entregado) && {
            entregadoEn: entrega.entregado ? (finDelDia(entrega.entregado) ?? null) : null,
          }),
        });
        mostrar({ mensaje: t.proyecto.guardado });
      } else {
        const nuevo = await proyectos.crear({ nombre, descripcion, cliente, color, inicio, entregaEstimada });
        mostrar({ mensaje: t.proyecto.creado });
        navegar(`/proyectos/${nuevo.id}`);
      }
      alCerrar();
    } catch (error) {
      console.error(error);
      mostrar({ mensaje: t.errores.generico, tono: 'error' });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Sheet
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={original ? t.proyecto.editar : t.proyecto.nuevo}
      pie={
        <div className="ml-auto flex gap-2">
          <Button onClick={alCerrar} className="max-sm:hidden">
            {t.acciones.cancelar}
          </Button>
          <Button type="submit" form={idForm} variante="primario" disabled={!nombre.trim() || guardando}>
            {original ? t.acciones.guardar : t.acciones.crear}
          </Button>
        </div>
      }
    >
      <form
        id={idForm}
        onSubmit={guardar}
        onKeyDown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && void guardar()}
        className="flex flex-col gap-5"
      >
        <Campo etiqueta={t.campos.nombre} htmlFor={idNombre}>
          <Input
            id={idNombre}
            data-autofocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={t.campos.nombrePlaceholder}
            enterKeyHint="done"
          />
        </Campo>
        <Campo etiqueta={t.campos.cliente} htmlFor={idCliente}>
          <Input
            id={idCliente}
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            placeholder={t.campos.clientePlaceholder}
            enterKeyHint="done"
          />
        </Campo>
        <Campo etiqueta={t.campos.descripcion} htmlFor={idDescripcion}>
          <Textarea
            id={idDescripcion}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder={t.campos.descripcionPlaceholder}
            rows={2}
          />
        </Campo>
        <CamposEntrega
          valores={entrega}
          alCambiar={setEntrega}
          entregaOriginal={original?.entregaEstimadaInicial}
          editando={!!original}
        />
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-texto-2">{t.campos.color}</legend>
          <div className="flex flex-wrap gap-1">
            {COLORES_PROYECTO.map((c, i) => (
              <label key={c} className="relative flex size-11 cursor-pointer items-center justify-center md:size-9">
                <input
                  type="radio"
                  name="color"
                  value={c}
                  checked={color === c}
                  onChange={() => setColor(c)}
                  className="peer sr-only"
                  aria-label={t.campos.nombresColores[i] ?? c}
                />
                <span
                  className={cn(
                    'flex size-8 items-center justify-center rounded-full transition-transform peer-focus-visible:ring-2 peer-focus-visible:ring-acento peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-superficie md:size-7',
                    color === c ? 'scale-110' : 'hover:scale-105',
                  )}
                  style={{ backgroundColor: c }}
                >
                  {color === c && <Check className="size-4 text-white" strokeWidth={3} aria-hidden />}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {original && (
          <Campo etiqueta={t.campos.estado}>
            <Segmentado
              etiqueta={t.campos.estado}
              opciones={ESTADOS_PROYECTO}
              valor={estado}
              alCambiar={setEstado}
              render={(e) => t.estadoProyecto[e]}
            />
          </Campo>
        )}
      </form>
    </Sheet>
  );
}
