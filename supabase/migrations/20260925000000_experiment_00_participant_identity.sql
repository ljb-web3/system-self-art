create table public.experiment_00_participants (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null unique,
  subject_number bigint generated always as identity (start with 1001) unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.experiment_00_participants enable row level security;

-- Keep updated_at correct if this table is updated by trusted server-side code later.
create function public.set_experiment_00_participant_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_experiment_00_participant_updated_at
before update on public.experiment_00_participants
for each row
execute function public.set_experiment_00_participant_updated_at();

create function public.get_or_create_experiment_00_participant(p_participant_id uuid)
returns table (
  id uuid,
  participant_id uuid,
  subject_number bigint,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_participant_id is null then
    raise exception 'participant_id is required' using errcode = '22004';
  end if;

  loop
    return query
      select
        participant.id,
        participant.participant_id,
        participant.subject_number,
        participant.created_at,
        participant.updated_at
      from public.experiment_00_participants as participant
      where participant.participant_id = p_participant_id;

    if found then
      return;
    end if;

    begin
      return query
        insert into public.experiment_00_participants (participant_id)
        values (p_participant_id)
        returning
          experiment_00_participants.id,
          experiment_00_participants.participant_id,
          experiment_00_participants.subject_number,
          experiment_00_participants.created_at,
          experiment_00_participants.updated_at;
      return;
    exception
      when unique_violation then
        -- A concurrent call inserted this participant. The next loop iteration
        -- reads that committed row and returns the same subject number.
    end;
  end loop;
end;
$$;

revoke all on table public.experiment_00_participants from public, anon, authenticated;
revoke all on function public.set_experiment_00_participant_updated_at() from public, anon, authenticated;
revoke all on function public.get_or_create_experiment_00_participant(uuid) from public;
grant execute on function public.get_or_create_experiment_00_participant(uuid) to anon, authenticated;
