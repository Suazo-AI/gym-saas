import { createClient } from "@/lib/supabase/server";

export default async function TestSupabasePage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("saas_plans")
    .select("id, code, name")
    .limit(5);

  return (
    <main className="p-8">
      <h1>Prueba de Supabase</h1>

      <pre>
        {JSON.stringify(
          {
            connected: !error,
            data,
            error,
          },
          null,
          2,
        )}
      </pre>
    </main>
  );
}