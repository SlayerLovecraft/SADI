"""
Helper script to search and query Resolucion 3280 de 2018 in milliseconds.
Uses SQLite FTS5 index stored in resolucion_3280.db.
"""
import sqlite3
import sys
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'resolucion_3280.db')

def search_text(query, limit=5):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    # Format query for FTS5: if plain words, join with NEAR or AND
    tokens = query.strip().split()
    fts_query = ' '.join(f'"{t}"' for t in tokens)
    sql = """
    SELECT page_num, snippet(pages_fts, 1, '***', '***', '...', 25)
    FROM pages_fts
    WHERE pages_fts MATCH ?
    ORDER BY rank
    LIMIT ?
    """
    try:
        rows = c.execute(sql, (fts_query, limit)).fetchall()
    except Exception:
        # Fallback to simple match
        rows = c.execute(sql, (query, limit)).fetchall()
    return rows

def get_page(page_num):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    row = c.execute("SELECT content FROM pages WHERE page_num = ?", (page_num,)).fetchone()
    return row[0] if row else None

if __name__ == '__main__':
    if len(sys.argv) > 1:
        q = ' '.join(sys.argv[1:])
        results = search_text(q)
        print(f"Results for '{q}':")
        for page_num, snippet in results:
            print(f"\n[Página {page_num}]:\n{snippet}\n")
    else:
        print("Usage: python search_3280.py <query>")
