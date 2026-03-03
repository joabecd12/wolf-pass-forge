import { supabase } from "@/integrations/supabase/client";

const BATCH_SIZE = 1000;

/**
 * Fetches all records from a Supabase query using .range() pagination
 * to bypass the default 1,000 row limit.
 */
export async function fetchAllRows(
  tableName: string,
  selectColumns: string,
  filters?: (query: any) => any
): Promise<any[]> {
  const allData: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = (supabase as any)
      .from(tableName)
      .select(selectColumns)
      .range(from, from + BATCH_SIZE - 1);

    if (filters) {
      query = filters(query);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    if (data && data.length > 0) {
      allData.push(...data);
      from += BATCH_SIZE;
      hasMore = data.length === BATCH_SIZE;
    } else {
      hasMore = false;
    }
  }

  return allData;
}
