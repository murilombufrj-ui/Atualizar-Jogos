import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

// Configurações do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// URL do Pipedream
const pipedreamUrl = process.env.PIPEDREAM_WEBHOOK;

async function run() {
  try {
    console.log("Rodando atualização de jogos...");

    if (!supabaseUrl || !supabaseKey || !pipedreamUrl) {
      console.warn("Um ou mais secrets estão faltando!");
      console.log("SUPABASE_URL:", supabaseUrl ? "OK" : "MISSING");
      console.log("SUPABASE_KEY:", supabaseKey ? "OK" : "MISSING");
      console.log("PIPEDREAM_URL:", pipedreamUrl ? "OK" : "MISSING");
      return;
    }

    const now = new Date();

    // Buscar jogos sem resultado
    const { data: jogos, error } = await supabase
      .from("matches")
      .select("home,away,data,hora,gols_home,gols_away")
      .is("gols_home", null)
      .is("gols_away", null);

    if (error) {
      console.error("Erro ao buscar jogos no Supabase:", error);
      return;
    }

    if (!jogos || jogos.length === 0) {
      console.log("Nenhum jogo pendente encontrado.");
      return;
    }

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
    const keys = Object.keys(janelas);
    if (keys.length === 0) {
      console.log("Nenhuma janela ativa no momento.");
      return;
    }

    for (const key of keys) {
      const jogosNaJanela = janelas[key];
      console.log(`Disparando Pipedream para a janela ${key}:`, jogosNaJanela);

      try {
        const res = await fetch(pipedreamUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jogos: jogosNaJanela }),
        });
        const text = await res.text();
        console.log("Resposta Pipedream:", text);
      } catch (err) {
        console.error("Erro ao chamar Pipedream:", err);
      }
    }

  } catch (err) {
    console.error("Erro geral no workflow:", err);
  }

  console.log("Script finalizado com sucesso.");
}

run();

