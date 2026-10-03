-- Public read-only aggregates for the mobile Part pages. No study rows are exposed.
create function public.get_experiment_00_top_ratings(p_part smallint)
returns table (
  subject smallint,
  rating smallint,
  observation_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_part is null or p_part not in (1, 2, 3) then
    raise exception 'part must be 1, 2, or 3' using errcode = '22023';
  end if;

  return query
    with part_data as (
      select case p_part
        when 1 then study.part_01_data
        when 2 then study.part_02_data
        else study.part_03_data
      end as answers
      from public.experiment_00_study_state as study
    ), valid_ratings as (
      select
        field.subject,
        case
          when (part_data.answers ->> field.field_name) ~ '^(10|[1-9])$'
            then (part_data.answers ->> field.field_name)::smallint
          else null
        end as rating
      from part_data
      cross join (values
        (1::smallint, 'subject1ConnectionRating'::text),
        (2::smallint, 'subject2ConnectionRating'::text)
      ) as field(subject, field_name)
    ), counts as (
      select
        valid_ratings.subject,
        valid_ratings.rating,
        count(*) as observation_count
      from valid_ratings
      where valid_ratings.rating is not null
      group by valid_ratings.subject, valid_ratings.rating
    ), ranked as (
      select
        counts.subject,
        counts.rating,
        counts.observation_count,
        row_number() over (
          partition by counts.subject
          order by counts.observation_count desc, counts.rating asc
        ) as rank
      from counts
    )
    select ranked.subject, ranked.rating, ranked.observation_count
    from ranked
    where ranked.rank <= 3
    order by ranked.subject, ranked.observation_count desc, ranked.rating asc;
end;
$$;

create function public.get_experiment_00_part_05_counts()
returns table (
  yes_count bigint,
  no_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*) filter (where study.part_05_data ->> 'wantsFurtherConnection' = 'yes') as yes_count,
    count(*) filter (where study.part_05_data ->> 'wantsFurtherConnection' = 'no') as no_count
  from public.experiment_00_study_state as study;
$$;

revoke all on function public.get_experiment_00_top_ratings(smallint) from public;
revoke all on function public.get_experiment_00_part_05_counts() from public;
grant execute on function public.get_experiment_00_top_ratings(smallint) to anon, authenticated;
grant execute on function public.get_experiment_00_part_05_counts() to anon, authenticated;
