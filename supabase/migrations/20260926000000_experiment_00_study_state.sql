create table public.experiment_00_study_state (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null,
  current_step text,
  welcome_age smallint,
  welcome_country text,
  welcome_gender text,
  welcome_ethnicity text,
  part_01_data jsonb not null default '{}'::jsonb,
  part_02_data jsonb not null default '{}'::jsonb,
  part_03_data jsonb not null default '{}'::jsonb,
  part_04_data jsonb not null default '{}'::jsonb,
  part_05_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint experiment_00_study_state_participant_fk
    foreign key (participant_id)
    references public.experiment_00_participants (participant_id)
    on delete cascade,
  constraint experiment_00_study_state_one_row_per_participant unique (participant_id),
  constraint experiment_00_study_state_age_check
    check (welcome_age is null or welcome_age between 18 and 120),
  constraint experiment_00_study_state_step_check
    check (
      current_step is null or current_step in (
        'welcome',
        'part-01',
        'observations-01-1',
        'observations-01-2',
        'reveal-part-01',
        'end-part-01',
        'part-02',
        'observations-02-1',
        'observations-02-2',
        'reveal-part-02',
        'end-part-02',
        'part-03',
        'observations-03-1',
        'observations-03-2',
        'reveal-part-03',
        'end-part-03',
        'part-04',
        'observations-04',
        'reveal-part-04',
        'comparison-part-04',
        'end-part-04',
        'part-05',
        'end-experiment-00'
      )
    ),
  constraint experiment_00_study_state_part_01_object_check
    check (jsonb_typeof(part_01_data) = 'object'),
  constraint experiment_00_study_state_part_02_object_check
    check (jsonb_typeof(part_02_data) = 'object'),
  constraint experiment_00_study_state_part_03_object_check
    check (jsonb_typeof(part_03_data) = 'object'),
  constraint experiment_00_study_state_part_04_object_check
    check (jsonb_typeof(part_04_data) = 'object'),
  constraint experiment_00_study_state_part_05_object_check
    check (jsonb_typeof(part_05_data) = 'object')
);

alter table public.experiment_00_study_state enable row level security;

create function public.set_experiment_00_study_state_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_experiment_00_study_state_updated_at
before update on public.experiment_00_study_state
for each row
execute function public.set_experiment_00_study_state_updated_at();

create function public.get_experiment_00_study_state(p_participant_id uuid)
returns table (
  participant_id uuid,
  current_step text,
  welcome_age smallint,
  welcome_country text,
  welcome_gender text,
  welcome_ethnicity text,
  part_01_data jsonb,
  part_02_data jsonb,
  part_03_data jsonb,
  part_04_data jsonb,
  part_05_data jsonb,
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

  return query
    select
      study.participant_id,
      study.current_step,
      study.welcome_age,
      study.welcome_country,
      study.welcome_gender,
      study.welcome_ethnicity,
      study.part_01_data,
      study.part_02_data,
      study.part_03_data,
      study.part_04_data,
      study.part_05_data,
      study.created_at,
      study.updated_at
    from public.experiment_00_study_state as study
    inner join public.experiment_00_participants as participant
      on participant.participant_id = study.participant_id
    where participant.participant_id = p_participant_id;
end;
$$;

create function public.save_experiment_00_study_state(
  p_participant_id uuid,
  p_payload jsonb
)
returns table (
  participant_id uuid,
  current_step text,
  welcome_age smallint,
  welcome_country text,
  welcome_gender text,
  welcome_ethnicity text,
  part_01_data jsonb,
  part_02_data jsonb,
  part_03_data jsonb,
  part_04_data jsonb,
  part_05_data jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  payload_age smallint;
begin
  if p_participant_id is null then
    raise exception 'participant_id is required' using errcode = '22004';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload must be a JSON object' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.experiment_00_participants as participant
    where participant.participant_id = p_participant_id
  ) then
    raise exception 'participant does not exist' using errcode = '23503';
  end if;

  if coalesce(p_payload ->> 'welcome_age', '') ~ '^[0-9]{1,3}$' then
    payload_age := (p_payload ->> 'welcome_age')::smallint;
  end if;

  return query
    insert into public.experiment_00_study_state as study (
      participant_id,
      current_step,
      welcome_age,
      welcome_country,
      welcome_gender,
      welcome_ethnicity,
      part_01_data,
      part_02_data,
      part_03_data,
      part_04_data,
      part_05_data
    )
    values (
      p_participant_id,
      nullif(p_payload ->> 'current_step', ''),
      payload_age,
      nullif(p_payload ->> 'welcome_country', ''),
      nullif(p_payload ->> 'welcome_gender', ''),
      nullif(p_payload ->> 'welcome_ethnicity', ''),
      coalesce(p_payload -> 'part_01_data', '{}'::jsonb),
      coalesce(p_payload -> 'part_02_data', '{}'::jsonb),
      coalesce(p_payload -> 'part_03_data', '{}'::jsonb),
      coalesce(p_payload -> 'part_04_data', '{}'::jsonb),
      coalesce(p_payload -> 'part_05_data', '{}'::jsonb)
    )
    on conflict on constraint experiment_00_study_state_one_row_per_participant do update
    set
      current_step = excluded.current_step,
      welcome_age = excluded.welcome_age,
      welcome_country = excluded.welcome_country,
      welcome_gender = excluded.welcome_gender,
      welcome_ethnicity = excluded.welcome_ethnicity,
      part_01_data = excluded.part_01_data,
      part_02_data = excluded.part_02_data,
      part_03_data = excluded.part_03_data,
      part_04_data = excluded.part_04_data,
      part_05_data = excluded.part_05_data
    returning
      study.participant_id,
      study.current_step,
      study.welcome_age,
      study.welcome_country,
      study.welcome_gender,
      study.welcome_ethnicity,
      study.part_01_data,
      study.part_02_data,
      study.part_03_data,
      study.part_04_data,
      study.part_05_data,
      study.created_at,
      study.updated_at;
end;
$$;

-- The UUID is an unguessable bearer identifier for this anonymous study. Direct
-- table access remains closed; anon clients can only address one UUID at a time.
revoke all on table public.experiment_00_study_state from public, anon, authenticated;
revoke all on function public.set_experiment_00_study_state_updated_at() from public, anon, authenticated;
revoke all on function public.get_experiment_00_study_state(uuid) from public;
revoke all on function public.save_experiment_00_study_state(uuid, jsonb) from public;
grant execute on function public.get_experiment_00_study_state(uuid) to anon, authenticated;
grant execute on function public.save_experiment_00_study_state(uuid, jsonb) to anon, authenticated;
