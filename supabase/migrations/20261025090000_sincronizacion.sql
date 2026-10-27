-- Sincronización de Bitácora entre dispositivos.
--
-- La app guarda todo en el dispositivo (IndexedDB) y sincroniza con estas tablas. Cada fila es
-- una entidad completa en `datos` (el mismo JSON que guarda la app), así agregar un campo
-- nuevo no requiere migración. Los borrados son lógicos (`datos.eliminadoEn`): nunca se borran filas.
--
-- Columnas:
--   updated_at   la última edición según el dispositivo que la hizo: gana la más reciente.
--   servidor_en  cuándo la recibió el servidor: es el cursor para "dame lo nuevo desde X".

create or replace function public.antes_de_sincronizar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Gana la última edición: una versión más vieja que la guardada se descarta sin error.
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;
  end if;
  new.servidor_en := clock_timestamp();
  return new;
end;
$$;

do $$
declare
  tabla text;
begin
  foreach tabla in array array['proyectos', 'tareas', 'notas', 'historial'] loop
    execute format($f$
      create table public.%1$I (
        id uuid primary key,
        user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
        datos jsonb not null,
        updated_at timestamptz not null,
        servidor_en timestamptz not null default clock_timestamp()
      );
      create index %1$s_user_servidor_en on public.%1$I (user_id, servidor_en);

      create trigger antes_de_sincronizar
        before insert or update on public.%1$I
        for each row execute function public.antes_de_sincronizar();

      alter table public.%1$I enable row level security;
      create policy "ver lo propio" on public.%1$I
        for select to authenticated using (user_id = (select auth.uid()));
      create policy "crear lo propio" on public.%1$I
        for insert to authenticated with check (user_id = (select auth.uid()));
      create policy "editar lo propio" on public.%1$I
        for update to authenticated
        using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

      -- Sin borrado físico: los borrados viajan como datos.eliminadoEn.
      revoke all on public.%1$I from anon;
      revoke delete, truncate on public.%1$I from authenticated;

      alter publication supabase_realtime add table public.%1$I;
    $f$, tabla);
  end loop;
end;
$$;
