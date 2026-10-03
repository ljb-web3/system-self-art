import { supabase } from './lib/supabase'

export type RatingAggregate = {
  subject: 1 | 2
  rating: number
  count: number
}

export type PartFiveCounts = {
  yes: number
  no: number
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

export async function loadTopRatings(part: '01' | '02' | '03'): Promise<RatingAggregate[]> {
  const { data, error } = await supabase.rpc('get_experiment_00_top_ratings', {
    p_part: Number(part),
  })
  if (error) throw new Error(error.message)
  if (!Array.isArray(data)) throw new Error('Invalid rating aggregates')

  return data.map((row: Record<string, unknown>) => {
    if (
      (row.subject !== 1 && row.subject !== 2)
      || !isCount(row.rating)
      || row.rating < 1
      || row.rating > 10
      || !isCount(row.observation_count)
    ) throw new Error('Invalid rating aggregate row')

    return {
      subject: row.subject,
      rating: row.rating,
      count: row.observation_count,
    }
  })
}

export async function loadPartFiveCounts(): Promise<PartFiveCounts> {
  const { data, error } = await supabase.rpc('get_experiment_00_part_05_counts')
  if (error) throw new Error(error.message)
  const row = Array.isArray(data) ? data[0] : data
  if (!row || !isCount(row.yes_count) || !isCount(row.no_count)) {
    throw new Error('Invalid Part 05 counts')
  }

  return { yes: row.yes_count, no: row.no_count }
}
