import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

// Configurações do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// URL do workflow Pipedream
const pipedreamUrl = process.env.PIPEDREAM_WEBHOOK;

async function run() {
  const now = new Date();

  // Buscar jogos sem resultado
  const { data: jogos, error } = await supabase
    .from("matches")
    .select("home,away,data,hora,gols_home,gols_away")
    .is("gols_home", null)
    .is("gols_away", null);

  if (error) throw error;

  // Agrupar por janela (data + hora do jogo)
  const janelas = {};
  for (const jogo of jogos) {
    const jogoDate = new Date(`${jogo.data}T${jogo.hora}`);
    const janelaFim = new Date(jogoDate.getTime() + 2 * 60 * 60 * 1000); // +2h

    if (now >= jogoDate && now <= janelaFim) {
      const key = `${jogo.data}_${jogo.hora}`;
      if (!janelas[key]) janelas[key] = [];
      janelas[key].push({ home: jogo.home, away: jogo.away });
    }
  }

  // Disparar Pipedream
  for (const key of Object.keys(janelas)) {
    const jogosNaJanela = janelas[key];
    console.log(`Disparando Pipedream para a janela ${key}:`, jogosNaJanela);

    const res = await fetch(pipedreamUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jogos: jogosNaJanela }),
    });

    console.log(await res.text());
  }
}

run().catch(err => {
  console.error("Erro no workflow:", err);
  // Não encerra com exit, apenas loga
});
