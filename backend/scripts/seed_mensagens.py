"""Popula um histórico de conversa de EXEMPLO entre gestor e encarregado,
para a tela /mensagens não ficar vazia na demonstração.

Uso:
    venv/Scripts/python.exe scripts/seed_mensagens.py          # limpa e recria
    venv/Scripts/python.exe scripts/seed_mensagens.py --clear  # só remove

Depende dos trechos de EXEMPLO já existirem (rode seed_exemplos.py antes).
Mensagens ficam marcadas com is_exemplo=1 e não interferem nas mensagens
reais que o gestor enviar pela tela.

Só gera a conversa com o Carlos Andrade (SP-330) — é o único encarregado
com conta de login (tabela `usuarios`). Uma "Fernanda Lima" (SP-348) existia
aqui antes de o login por conta real substituir a lista fixa de equipes;
como ela não tem usuário pra logar e ver a conversa, essas mensagens ficavam
órfãs — removidas até que exista uma segunda conta de encarregado real.
"""

import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import db  # noqa: E402


def _ts(dias_atras: int, hora: int, minuto: int) -> str:
    momento = datetime.now() - timedelta(days=dias_atras)
    return momento.replace(hour=hora, minute=minuto, second=0, microsecond=0).strftime("%Y-%m-%d %H:%M:%S")


def clear_mensagens(conn):
    ids = [row["id"] for row in conn.execute("SELECT id FROM mensagens WHERE is_exemplo = 1").fetchall()]
    if ids:
        placeholders = ",".join("%s" for _ in ids)
        conn.execute(f"DELETE FROM mensagens WHERE id IN ({placeholders})", ids)
    conn.commit()
    return len(ids)


def _video_por_trecho(conn, trecho_like: str):
    row = conn.execute(
        "SELECT * FROM videos WHERE is_exemplo = 1 AND nome_trecho LIKE %s ORDER BY id LIMIT 1",
        (f"%{trecho_like}%",),
    ).fetchone()
    return dict(row) if row else None


def seed(conn):
    v_critico = _video_por_trecho(conn, "Km 45 a 47")
    v_alerta = _video_por_trecho(conn, "Km 96 a 97")

    if not all([v_critico, v_alerta]):
        print("Trechos de exemplo não encontrados. Rode seed_exemplos.py primeiro.")
        return 0

    carlos = {"destinatario": "Carlos Andrade", "cargo": "Encarregado de roçada — SP-330 (Anhanguera)"}

    data_solicitada = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

    mensagens = [
        # Conversa com Carlos (SP-330)
        (v_critico["id"], carlos, "encarregado", "texto", None,
         "Bom dia! Pode confirmar o próximo trecho crítico da Anhanguera?", _ts(2, 8, 5)),
        (v_critico["id"], carlos, "gestor", "texto", None,
         "Bom dia, Carlos! O trecho Km 45 a 47 está com 31.1cm — status CRÍTICO.", _ts(2, 8, 12)),
        (v_critico["id"], carlos, "gestor", "solicitacao", data_solicitada,
         f"Trecho SP-330 (Anhanguera) — Km 45 a 47 está com vegetação a 31.1cm — status CRÍTICO. Por favor, priorize a roçada o quanto antes.",
         _ts(2, 8, 13)),
        (v_critico["id"], carlos, "encarregado", "texto", None,
         "Recebido! Equipe vai até lá amanhã cedo.", _ts(2, 8, 40)),
        (v_alerta["id"], carlos, "encarregado", "texto", None,
         "Roçada do Km 45 a 47 concluída ✅. Aproveitando, o Km 96 a 97 também já está em 21.4cm, fica de olho.", _ts(1, 17, 10)),
        (v_alerta["id"], carlos, "gestor", "texto", None,
         "Show, obrigado! Vou acompanhar o Km 96 a 97 pelo dashboard.", _ts(1, 17, 25)),
    ]

    for video_id, contato, remetente, tipo, data_sol, texto, enviada_em in mensagens:
        conn.execute(
            "INSERT INTO mensagens (video_id, destinatario, cargo, mensagem, remetente, tipo, data_solicitada, "
            "enviada_em, is_exemplo) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 1)",
            (video_id, contato["destinatario"], contato["cargo"], texto, remetente, tipo, data_sol, enviada_em),
        )
    conn.commit()
    return len(mensagens)


def main():
    db.init_db()
    conn = db.get_connection()
    removidas = clear_mensagens(conn)
    print(f"Removidas {removidas} mensagem(ns) de exemplo anterior(es).")

    if "--clear" not in sys.argv:
        total = seed(conn)
        if total:
            print(f"Inseridas {total} mensagens de exemplo.")

    conn.close()


if __name__ == "__main__":
    main()
