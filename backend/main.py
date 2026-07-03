import builtins
import os
import sys
import json
import traceback
import threading
import queue as std_queue
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# PostgreSQL接続用
import psycopg2
from psycopg2.extras import Json

# Cloud SQL Proxy 用（オプション）
try:
    from google.cloud.sql.connector import Connector
    CLOUD_SQL_AVAILABLE = True
except ImportError:
    CLOUD_SQL_AVAILABLE = False
    Connector = None

import numpy as np
from flask import Flask, request, jsonify, make_response, Response, stream_with_context
app = Flask(__name__)
app.json.sort_keys = False
import time
from datetime import datetime, date, timedelta
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
from amplify import VariableGenerator, sum, solve, one_hot, less_equal, AmplifyAEClient, ToshibaSQBM2Client


# ============
# JSON入力（どちらか片方でOK）
# 1) ファイルから読む場合：RECIPE_JSON_PATH / COST_JSON_PATH を使う
# 2) ベタ打ち文字列の場合：RECIPES_JSON_STR / COST_JSON_STR を使う
# ============
RECIPE_JSON_PATH = os.path.join(os.path.dirname(__file__), "data", "reciept.json")
COST_JSON_PATH   = os.path.join(os.path.dirname(__file__), "data", "reciept-cost.json")

# ============
# カテゴリ対応（あなたのデータに合わせて調整）
# ============
CATEGORY_NAME = {
    0: "主菜",
    1: "副菜",
    2: "主食",
    3: "汁物",
    4: "デザート",
}

# 主食・主菜は必須（=1）、他は0/1（上限1）
REQ_CATS = [2, 0]
OPT_CATS = [1, 3, 4]

# 表示順序：主食→主菜→副菜→汁物→デザート
DISPLAY_CAT_ORDER = [2, 0, 1, 3, 4]

# 牛乳データ（add_milk=True の場合に各日に追加する固定アイテム）
MILK_DATA = {
    "id": 999999,
    "title": "牛乳",
    "category": -1,
    "category_name": "飲み物",
    "genre": -1,
    "nutritions": {
        "エネルギー": 61.0,
        "たんぱく質": 3.3,
        "脂質": 3.8,
        "ナトリウム": 41.0,
    },
    "ingredients": [],
    "recipe_cost": 20.0,
    "amount_ml": 200.0,
}


# ============
# 祝日リスト（土日スキップと合わせて学校給食の提供日を算出するために使用）
# ============
JAPANESE_HOLIDAYS = {
    # 2026年
    date(2026,  1,  1),  # 元日
    date(2026,  1, 12),  # 成人の日
    date(2026,  2, 11),  # 建国記念の日
    date(2026,  2, 23),  # 天皇誕生日
    date(2026,  3, 20),  # 春分の日
    date(2026,  4, 29),  # 昭和の日
    date(2026,  5,  3),  # 憲法記念日
    date(2026,  5,  4),  # みどりの日
    date(2026,  5,  5),  # こどもの日
    date(2026,  5,  6),  # 休日（振替）
    date(2026,  7, 20),  # 海の日
    date(2026,  8, 11),  # 山の日
    date(2026,  9, 21),  # 敬老の日
    date(2026,  9, 22),  # 休日（振替）
    date(2026,  9, 23),  # 秋分の日
    date(2026, 10, 12),  # スポーツの日
    date(2026, 11,  3),  # 文化の日
    date(2026, 11, 23),  # 勤労感謝の日
    # 2027年
    date(2027,  1,  1),  # 元日
    date(2027,  1, 11),  # 成人の日
    date(2027,  2, 11),  # 建国記念の日
    date(2027,  2, 23),  # 天皇誕生日
    date(2027,  3, 21),  # 春分の日
    date(2027,  3, 22),  # 休日（振替）
    date(2027,  4, 29),  # 昭和の日
    date(2027,  5,  3),  # 憲法記念日
    date(2027,  5,  4),  # みどりの日
    date(2027,  5,  5),  # こどもの日
    date(2027,  7, 19),  # 海の日
    date(2027,  8, 11),  # 山の日
    date(2027,  9, 20),  # 敬老の日
    date(2027,  9, 23),  # 秋分の日
    date(2027, 10, 11),  # スポーツの日
    date(2027, 11,  3),  # 文化の日
    date(2027, 11, 23),  # 勤労感謝の日
}


def get_school_days(start_date, n):
    """
    start_date から数えて、土日・祝日を除いた n 個の学校給食提供日リストを返す。
    start_date 自体が土日・祝日の場合はスキップして次の提供日から開始する。
    """
    school_days = []
    current = start_date
    while len(school_days) < n:
        if current.weekday() < 5 and current not in JAPANESE_HOLIDAYS:
            school_days.append(current)
        current += timedelta(days=1)
    return school_days


def count_school_days(start_date, end_date):
    """
    start_date から end_date の間（両端含む）の学校給食提供日数を返す。
    土日・祝日は除外する。
    """
    if isinstance(start_date, str):
        start_date = date.fromisoformat(start_date)
    if isinstance(end_date, str):
        end_date = date.fromisoformat(end_date)
    count = 0
    current = start_date
    while current <= end_date:
        if current.weekday() < 5 and current not in JAPANESE_HOLIDAYS:
            count += 1
        current += timedelta(days=1)
    return count


# ============
# データベース接続関数
# ============
def get_db_connection():
    """PostgreSQLデータベースへの接続を取得"""

    # Cloud SQL接続名が設定されている場合は Cloud SQL Proxy を使用
    cloud_sql_connection_name = os.getenv("CLOUD_SQL_CONNECTION_NAME")

    if cloud_sql_connection_name and CLOUD_SQL_AVAILABLE:
        # Cloud SQL Proxy 経由で接続（VPC Connector 不要）
        print(f"[INFO] Connecting to Cloud SQL via Proxy: {cloud_sql_connection_name}")
        connector = Connector()

        conn = connector.connect(
            cloud_sql_connection_name,
            "pg8000",
            user=os.getenv("DB_USER", "postgres"),
            password=os.getenv("DB_PASSWORD", ""),
            db=os.getenv("DB_NAME", "kondate-db")
        )
        return conn
    else:
        # 従来の TCP/IP 接続（ローカル開発環境 or VPC Connector 経由）
        print(f"[INFO] Connecting to PostgreSQL via TCP/IP: {os.getenv('DB_HOST', 'localhost')}")
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST", "localhost"),
            port=os.getenv("DB_PORT", "5432"),
            database=os.getenv("DB_NAME", "kondate-db"),
            user=os.getenv("DB_USER", "postgres"),
            password=os.getenv("DB_PASSWORD", "")
        )
        return conn


def save_menu_to_db(school_id, start_date, plan_type, plan):
    """
    献立を1日1レコードとして school_menus テーブルに保存する。

    同じ (school_id, target_date, plan_type) の既存レコードは論理削除してから
    新規挿入するため、日付単位で正確な上書き管理が可能。

    Args:
        school_id (str): 小学校ID（UUID）
        start_date (str | date): 最初の提供日（YYYY-MM-DD 文字列 または date オブジェクト）
        plan_type (str): 'A' または 'B'
        plan (dict): plan_a / plan_b の辞書。"days" と "daily_totals" キーを含む。

    Returns:
        list[int]: 保存された school_menu_id のリスト（日数分）
    """
    if isinstance(start_date, str):
        start_date = date.fromisoformat(start_date)

    days        = plan.get("days", [])
    # daily_totals を day 番号でインデックス化（1始まり）
    daily_totals = {dt["day"]: dt.get("totals", {}) for dt in plan.get("daily_totals", [])}

    # 土日・祝日を除いた提供日リストを事前に計算
    school_day_list = get_school_days(start_date, len(days))
    print(f"[INFO] 提供日リスト: {[d.isoformat() for d in school_day_list]}")

    conn = None
    saved_ids = []
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        for day_data in days:
            day_num     = day_data["day"]                          # 1始まり
            target_date = school_day_list[day_num - 1]            # 土日・祝日をスキップした提供日
            totals      = daily_totals.get(day_num, {})
            total_cost  = int(round(float(totals.get("cost", 0))))
            total_nutrition = {
                k: totals.get(k, 0)
                for k in ["エネルギー", "たんぱく質", "脂質", "ナトリウム"]
            }

            # 同日同コースの既存レコードを論理削除
            cur.execute("""
                UPDATE school_menus
                SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE school_id  = %s
                  AND target_date = %s
                  AND plan_type   = %s
                  AND deleted_at IS NULL
            """, (school_id, target_date, plan_type))

            deleted_count = cur.rowcount
            if deleted_count > 0:
                print(f"[INFO] 既存レコードを論理削除: date={target_date}, plan={plan_type}, 件数={deleted_count}")

            # 新規挿入
            cur.execute("""
                INSERT INTO school_menus
                    (school_id, target_date, plan_type, menu_data, total_cost, total_nutrition, created_at)
                VALUES
                    (%s, %s, %s, %s::jsonb, %s, %s::jsonb, CURRENT_TIMESTAMP)
                RETURNING school_menu_id
            """, (
                school_id,
                target_date,
                plan_type,
                json.dumps(day_data, ensure_ascii=False),
                total_cost,
                json.dumps(total_nutrition, ensure_ascii=False),
            ))

            row = cur.fetchone()
            if row is None:
                raise Exception(f"INSERT に失敗しました: date={target_date}, plan_type={plan_type}")
            saved_ids.append(row[0])

        conn.commit()
        cur.close()
        print(f"[INFO] 献立保存完了: {len(saved_ids)}日分, plan_type={plan_type}, 開始日={start_date}")
        return saved_ids

    except Exception as e:
        if conn:
            conn.rollback()
        raise e
    finally:
        if conn:
            conn.close()


def calc_start_date(target_year_month: str, target_week) -> str:
    """
    target_year_month (YYYY-MM-DD または YYYY-MM) と target_week から
    献立の開始日（YYYY-MM-DD 文字列）を計算する。

    第1週: 月の最初の平日（月〜金）
    第2週以降: 第1週の最初の平日から次の月曜日 + (target_week-2)*7 日後

    フロントエンドの週計算ロジックと一致させている。
    """
    ym = target_year_month[:7]  # YYYY-MM に正規化
    y, m = int(ym[:4]), int(ym[5:7])

    # 月の最初の平日（weekday: 0=月 … 4=金, 5=土, 6=日）
    d = date(y, m, 1)
    while d.weekday() >= 5:
        d += timedelta(days=1)

    if not target_week or int(target_week) <= 1:
        return d.isoformat()

    # 最初の平日から次の月曜日までの日数 (月=7, 火=6, 水=5, 木=4, 金=3)
    days_to_next_monday = 7 - d.weekday()
    start = d + timedelta(days=days_to_next_monday + (int(target_week) - 2) * 7)
    return start.isoformat()


def save_amplify_calculation_history(school_id, request_params, response_data, solver_time_sec, total_time_sec, num_variables, num_constraints, objective_value, solution_status):
    """
    Fixstars Amplify計算履歴をamplify_calculation_historyテーブルに保存
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        request_params_json = json.dumps(request_params, ensure_ascii=False)
        response_data_json = json.dumps(response_data, ensure_ascii=False)

        cur.execute("""
            INSERT INTO amplify_calculation_history
                (school_id, request_params, response_data, solver_time_sec, total_time_sec,
                 num_variables, num_constraints, objective_value, solution_status, created_at)
            VALUES
                (%s, %s::jsonb, %s::jsonb, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
            RETURNING calculation_id
        """, (
            school_id,
            request_params_json,
            response_data_json,
            solver_time_sec,
            total_time_sec,
            num_variables,
            num_constraints,
            objective_value,
            solution_status
        ))

        result = cur.fetchone()
        if result is None:
            raise Exception("Failed to insert calculation history")

        calculation_id = result[0]
        print(f"[INFO] Amplify計算履歴を保存しました: calculation_id={calculation_id}")

        conn.commit()
        cur.close()

        return calculation_id

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"[ERROR] Failed to save Amplify calculation history: {str(e)}")
        raise e
    finally:
        if conn:
            conn.close()


def load_json_sources():
    recipes_raw = json.loads(Path(RECIPE_JSON_PATH).read_text(encoding="utf-8"))
    cost_raw = json.loads(Path(COST_JSON_PATH).read_text(encoding="utf-8"))

    return recipes_raw, cost_raw


def build_price_table(cost_raw: list[dict]) -> tuple[dict[int, float], float]:
    price_per_g = {}
    for row in cost_raw:
        fid = row.get("food_id")
        c = row.get("cost")
        if fid is None or c is None:
            continue
        price_per_g[int(fid)] = float(c)

    if not price_per_g:
        raise ValueError("price_per_g is empty (cost JSON invalid).")

    median_price = float(np.median(list(price_per_g.values())))
    return price_per_g, median_price


def preprocess(recipes_raw, price_per_g, median_price):
    # active==1を優先
    recipes = [r for r in recipes_raw if int(r.get("active", 1)) == 1]
    N = len(recipes)
    if N == 0:
        raise ValueError("No active recipes found.")

    # 食材語彙
    all_food_ids = set()
    for r in recipes:
        for ing in r.get("ingredients", []):
            fid = ing.get("id")
            if fid is not None:
                all_food_ids.add(int(fid))
    food_vocab = sorted(all_food_ids)
    fid_to_idx = {fid: i for i, fid in enumerate(food_vocab)}
    K = len(food_vocab)

    NUT_KEYS = ["エネルギー", "たんぱく質", "脂質", "ナトリウム"]

    titles = []
    cats = np.zeros(N, dtype=int)
    genres = np.zeros(N, dtype=int)
    nut = np.zeros((N, len(NUT_KEYS)), dtype=float)
    recipe_cost = np.zeros(N, dtype=float)
    steps = np.zeros(N, dtype=int)
    X = np.zeros((N, K), dtype=float)  # 食材amountベクトル

    # フロント表示用に recipe_id を拾えるなら拾う（なければ idx を使う）
    recipe_ids = []

    for i, r in enumerate(recipes):
        recipe_ids.append(r.get("id", i))
        titles.append(r.get("title", f"recipe_{i}"))
        cats[i] = int(r.get("category", -1))
        genres[i] = int(r.get("genre", -1))
        steps[i] = int(r.get("steps", 0) or 0)

        nutr = r.get("nutritions", {}) or {}
        for k_idx, key in enumerate(NUT_KEYS):
            nut[i, k_idx] = float(nutr.get(key, 0.0) or 0.0)

        csum = 0.0
        for ing in r.get("ingredients", []):
            fid = ing.get("id")
            amt = ing.get("amount")
            if fid is None or amt is None:
                continue
            fid = int(fid)
            amt = float(amt)  # g
            price = float(price_per_g.get(fid, median_price))
            csum += amt * price

            j = fid_to_idx.get(fid)
            if j is not None:
                X[i, j] += amt

        recipe_cost[i] = csum

    return recipes, cats, genres, nut, recipe_cost, steps, X, NUT_KEYS


def build_similarity(X: np.ndarray, genres: np.ndarray, M: int, topk: int):
    # cosine similarity
    X_norm = np.linalg.norm(X, axis=1, keepdims=True) + 1e-9
    Xn = X / X_norm
    sim = (Xn @ Xn.T).astype(np.float32)
    np.fill_diagonal(sim, 0.0)

    # g: 同ジャンル
    g = (genres[:, None] == genres[None, :]).astype(np.int8)
    np.fill_diagonal(g, 0)

    # d: 隣接日
    days_idx = np.arange(M)
    d = (np.abs(days_idx[:, None] - days_idx[None, :]) == 1).astype(np.int8)

    # top neighbors
    N = X.shape[0]
    top_neighbors = []
    for i in range(N):
        idxs = np.argsort(-sim[i])
        nbrs = [int(j) for j in idxs[: topk + 1] if j != i][:topk]
        top_neighbors.append(nbrs)

    return sim, g, d, top_neighbors


def build_h1_category(x, M, cat_to_idxs, weight):
    """H1：主食・主菜は=1 / 副菜・汁物・デザートは<=1（ハード制約）"""
    result = None
    for r in range(M):
        for c in REQ_CATS:
            idxs = cat_to_idxs[c]
            cl = one_hot(sum([x[i, r] for i in idxs]), label=f"day{r}_{CATEGORY_NAME[c]}_eq1")
            result = cl if result is None else result + cl
        for c in OPT_CATS:
            idxs = cat_to_idxs[c]
            cl = less_equal(sum([x[i, r] for i in idxs]), 1, label=f"day{r}_{CATEGORY_NAME[c]}_le1")
            result = cl if result is None else result + cl
    result *= float(weight)
    return result


def build_h2_nutrition(x, M, N, nut, NUT_KEYS, TARGET, W):
    """H2：栄養（各日） — 正規化: 1/(ε_k · V_k)"""
    H2 = 0
    for r in range(M):
        for k_idx, key in enumerate(NUT_KEYS):
            Vk = float(TARGET[key])
            ek = float(W["epsilon"])
            beta_k = float(W["beta"].get(key, 1.0))
            Sx = (nut[:, k_idx] * x[:, r]).sum()
            H2 += beta_k * ((1.0 / (ek * Vk)) * (Sx - Vk)) ** 2
    return H2


def build_h3_cost(x, M, N, recipe_cost, TARGET, W):
    """H3：各スロットのコスト — 正規化: 1/(ε · C)。各スロット独立で目標値との偏差を計算。"""
    C_target = float(TARGET["cost"])
    eps_cost = float(W["epsilon"])
    H3 = 0
    for r in range(M):
        slot_cost = (recipe_cost * x[:, r]).sum()
        H3 += ((1.0 / (eps_cost * C_target)) * (slot_cost - C_target)) ** 2
    return float(W["H3"]) * H3


def build_h4_duplication(x, M, N, weight):
    """H4：同一レシピ重複抑制（期間中に各レシピは最大1回）（ハード制約）"""
    result = less_equal(x, 1, axis=1, label="recipe_once")
    result *= float(weight)
    return result


def build_h5_genre(x, M, N, genres, H5_MODE, weight):
    """H5：同日ジャンル制御（practical推奨：同ジャンルを罰→多様化）"""
    if H5_MODE == "paper":
        match = False
    elif H5_MODE == "practical":
        match = True
    else:
        raise ValueError("H5_MODE must be 'paper' or 'practical'.")

    H5 = 0
    for r in range(M):
        for i in range(N):
            for j in range(i + 1, N):
                if (genres[i] == genres[j]) == match:
                    H5 += x[i, r] * x[j, r]
    return float(weight) * H5


def build_h8_steps(x, M, N, steps, target_steps, weight, target_steps_per_day=None):
    """H8：各日の合計調理工程数（ソフト制約 — 目標値からの二乗偏差ペナルティ）
    target_steps_per_day が指定された場合、各日ごとに異なる目標値を使う。
    """
    H8 = 0
    for r in range(M):
        ts = target_steps_per_day[r] if target_steps_per_day else target_steps
        if ts <= 0:
            ts = 1  # ゼロ除算防止
        Sx = sum([int(steps[i]) * x[i, r] for i in range(N)])
        H8 += ((1.0 / ts) * (Sx - ts)) ** 2
    return float(weight) * H8


def build_h7_adjacency(x, M, N, d, g, sim, top_neighbors, weight):
    """H7：隣接日多様性（g + sim）"""
    H7 = 0
    for r in range(M):
        for rp in range(M):
            if d[r, rp] != 1:
                continue
            for i in range(N):
                for ip in top_neighbors[i]:
                    coef = float(g[i, ip]) + float(sim[i, ip])
                    if coef != 0.0:
                        H7 += coef * x[i, r] * x[ip, rp]
    return float(weight) * H7


def build_h7_prev_day(x, N, prev_chosen_idxs, g, sim, top_neighbors, weight):
    """前日の確定レシピとの隣接日多様性ペナルティ（逐次最適化用）
    x の全スロット（列）に対してペナルティを付与する。
    """
    num_slots = x.shape[1]
    H7 = 0
    for i in range(N):
        for ip in prev_chosen_idxs:
            if ip in top_neighbors[i] or i in top_neighbors[ip]:
                coef = float(g[i, ip]) + float(sim[i, ip])
                if coef != 0.0:
                    for s in range(num_slots):
                        H7 += coef * x[i, s]
    return float(weight) * H7


def solve_menu(
    recipes_raw,
    cost_raw,
    *,
    M: int,
    topk_sim: int,
    amplify_token: str,
    TARGET: dict,
    W: dict,
    H5_MODE: str = "practical",
    exclude_per_day: dict | None = None,
    steps_budget_per_day: dict | None = None,
):
    price_per_g, median_price = build_price_table(cost_raw)
    recipes, cats, genres, nut, recipe_cost, steps, X, NUT_KEYS = preprocess(recipes_raw, price_per_g, median_price)

    # カテゴリindex集合
    cat_to_idxs = {c: np.where(cats == c)[0].tolist() for c in sorted(set(cats))}
    for c in REQ_CATS + OPT_CATS:
        if len(cat_to_idxs.get(c, [])) == 0:
            raise ValueError(f"category {c} has no recipes. CATEGORY_NAME/REQ_CATS/OPT_CATS mapping mismatch.")

    t0 = time.time()
    sim, g, d, top_neighbors = build_similarity(X, genres, M, topk_sim)
    N = len(recipes)
    print(f"  [timer] preprocess + similarity: {time.time()-t0:.2f}s", flush=True)

    # 変数
    gen = VariableGenerator()
    x = gen.array("Binary", (N, M))

    # 除外制約（Bコース用: Aで同日に選ばれたレシピを変数値0に固定する）
    if exclude_per_day:
        rid_to_idx = {}
        for i, r in enumerate(recipes):
            rid_to_idx[r.get("id", i)] = i
        for day, excluded_ids in exclude_per_day.items():
            r_idx = int(day)
            if r_idx >= M:
                continue
            for rid in excluded_ids:
                i = rid_to_idx.get(rid)
                if i is not None:
                    x[i, r_idx] = 0

    # 日別工程数目標（Bコース用: A+B合計予算からAの実績を引いた値）
    target_steps_per_day = None
    if steps_budget_per_day:
        target_steps_per_day = []
        for r in range(M):
            ts = steps_budget_per_day.get(r, int(TARGET["target_steps"]))
            target_steps_per_day.append(max(1, ts))

    # 制約（ハード）
    t1 = time.time()
    h1 = build_h1_category(x, M, cat_to_idxs, W["H1"])
    print(f"  [timer] H1 category: {time.time()-t1:.2f}s", flush=True)

    t1 = time.time()
    h4 = build_h4_duplication(x, M, N, W["H4"])
    print(f"  [timer] H4 duplication: {time.time()-t1:.2f}s", flush=True)

    # 目的関数（ソフト）
    t1 = time.time()
    h2 = build_h2_nutrition(x, M, N, nut, NUT_KEYS, TARGET, W)
    print(f"  [timer] H2 nutrition: {time.time()-t1:.2f}s", flush=True)

    t1 = time.time()
    daily_cost_target_sm = {**TARGET, "cost": float(TARGET["cost"]) / M}
    h3 = build_h3_cost(x, M, N, recipe_cost, daily_cost_target_sm, W)
    print(f"  [timer] H3 cost: {time.time()-t1:.2f}s", flush=True)

    t1 = time.time()
    h5 = build_h5_genre(x, M, N, genres, H5_MODE, W["H5"])
    print(f"  [timer] H5 genre: {time.time()-t1:.2f}s", flush=True)

    t1 = time.time()
    h7 = build_h7_adjacency(x, M, N, d, g, sim, top_neighbors, W["H7"])
    print(f"  [timer] H7 adjacency: {time.time()-t1:.2f}s", flush=True)

    t1 = time.time()
    h8 = build_h8_steps(x, M, N, steps, int(TARGET["target_steps"]), W["H8"],
                        target_steps_per_day=target_steps_per_day)
    print(f"  [timer] H8 steps: {time.time()-t1:.2f}s", flush=True)

    # モデル構築 & 求解
    t1 = time.time()
    model = (h2 + h3 + h5 + h7 + h8) + (h1 + h4)
    print(f"  [timer] model build: {time.time()-t1:.2f}s", flush=True)

    client = AmplifyAEClient()
    client.token = amplify_token
    client.parameters.time_limit_ms = timedelta(milliseconds=3000)
    t1 = time.time()
    result = solve(model, client)
    print(f"  [timer] solve (API): {time.time()-t1:.2f}s", flush=True)
    print(f"  [timer] TOTAL: {time.time()-t0:.2f}s (N={N}, M={M})", flush=True)
    best = result.best
    vals = best.values

    # decode
    idx_to_recipe = {i: recipes[i] for i in range(N)}

    def get_recipe_detail(i: int):
        r = idx_to_recipe[i]
        # フロントに返す詳細（必要なものだけ）
        return {
            "idx": int(i),
            "id": r.get("id", i),
            "title": r.get("title", f"recipe_{i}"),
            "category": int(r.get("category", -1)),
            "category_name": CATEGORY_NAME.get(int(r.get("category", -1)), str(r.get("category", -1))),
            "genre": int(r.get("genre", -1)),
            "nutritions": r.get("nutritions", {}) or {},
            "ingredients": [
                {
                    "food_id": int(ing.get("id")) if ing.get("id") is not None else None,
                    "amount_g": float(ing.get("amount")) if ing.get("amount") is not None else None,
                    "name": (ing.get("food") or {}).get("name") if isinstance(ing.get("food"), dict) else ing.get("name"),
                    "unit_cost": float(price_per_g.get(int(ing.get("id")), median_price)) if ing.get("id") is not None else None,
                    "cost": (
                        float(ing.get("amount")) * float(price_per_g.get(int(ing.get("id")), median_price))
                        if (ing.get("id") is not None and ing.get("amount") is not None)
                        else None
                    ),
                }
                for ing in (r.get("ingredients", []) or [])
            ],
            "recipe_cost": float(recipe_cost[i]),
            "steps": int(steps[i]),
        }

    days = []
    daily_totals = []

    # カテゴリ別カウント（チェック用）
    checks = {"per_day_category_counts": []}

    for r in range(M):
        chosen = []
        for i in range(N):
            try:
                if vals[x[i, r]] == 1:
                    chosen.append(i)
            except (KeyError, TypeError):
                pass  # 固定変数（x[i,r]=0）はスキップ
        details = [get_recipe_detail(i) for i in chosen]

        # 日別集計（選ばれた分だけ合計）
        tot = {"cost": 0.0}
        for key in NUT_KEYS:
            tot[key] = 0.0

        total_steps = 0
        for drec in details:
            tot["cost"] += float(drec["recipe_cost"])
            total_steps += drec["steps"]
            nutr = drec.get("nutritions", {}) or {}
            for key in NUT_KEYS:
                tot[key] += float(nutr.get(key, 0.0) or 0.0)
        tot["steps"] = total_steps

        # チェック：カテゴリごとに何個選ばれてるか（表示順序を固定）
        cnt = {}
        for c in DISPLAY_CAT_ORDER:
            cnt[CATEGORY_NAME.get(c, str(c))] = builtins.sum(1 for drec in details if drec["category"] == c)

        checks["per_day_category_counts"].append({"day": r + 1, "counts": cnt})

        days.append({"day": r + 1, "recipes": details})
        daily_totals.append({"day": r + 1, "totals": tot})

    total_cost_value = builtins.sum(day["totals"]["cost"] for day in daily_totals)

    response = {
        "meta": {
            "M": M,
            "N_candidates": N,
            "target": TARGET,
            "weights": W,
            "h5_mode": H5_MODE,
            "topk_sim": topk_sim,
        },
        "plan": {
            "days": days,
            "daily_totals": daily_totals,
            "total_cost": float(total_cost_value),
        },
        "checks": checks,
    }

    return response

def solve_menu_ab(
    recipes_raw,
    cost_raw,
    *,
    M: int,
    topk_sim: int,
    amplify_token: str,
    TARGET: dict,
    W: dict,
    total_steps_budget: int,
    H5_MODE: str = "practical",
):
    """A/Bコース同時逐次最適化。各日 x[N,2] (slot0=A, slot1=B) で1回solve。"""
    price_per_g, median_price = build_price_table(cost_raw)
    recipes, cats, genres, nut, recipe_cost, steps, X, NUT_KEYS = preprocess(recipes_raw, price_per_g, median_price)

    cat_to_idxs = {c: np.where(cats == c)[0].tolist() for c in sorted(set(cats))}
    for c in REQ_CATS + OPT_CATS:
        if len(cat_to_idxs.get(c, [])) == 0:
            raise ValueError(f"category {c} has no recipes.")

    t0 = time.time()
    sim, g, _d, top_neighbors = build_similarity(X, genres, M, topk_sim)
    N = len(recipes)
    print(f"  [timer] preprocess + similarity: {time.time()-t0:.2f}s", flush=True)

    # コスト目標を1日あたりに変換
    daily_cost_target = float(TARGET["cost"]) / M

    # 結果蓄積
    used_idxs_a = set()         # Aコースで使用済みのレシピindex
    used_idxs_b = set()         # Bコースで使用済みのレシピindex
    prev_chosen_idxs = []       # 前日に選ばれたレシピindex（A+B両方）
    all_day_chosen_a = []       # 各日のAコース選択
    all_day_chosen_b = []       # 各日のBコース選択

    client = AmplifyAEClient()
    client.token = amplify_token
    client.parameters.time_limit_ms = timedelta(milliseconds=3000)

    idx_to_recipe = {i: recipes[i] for i in range(N)}

    def get_recipe_detail(i: int):
        r = idx_to_recipe[i]
        return {
            "idx": int(i),
            "id": r.get("id", i),
            "title": r.get("title", f"recipe_{i}"),
            "category": int(r.get("category", -1)),
            "category_name": CATEGORY_NAME.get(int(r.get("category", -1)), str(r.get("category", -1))),
            "genre": int(r.get("genre", -1)),
            "nutritions": r.get("nutritions", {}) or {},
            "ingredients": [
                {
                    "food_id": int(ing.get("id")) if ing.get("id") is not None else None,
                    "amount_g": float(ing.get("amount")) if ing.get("amount") is not None else None,
                    "name": (ing.get("food") or {}).get("name") if isinstance(ing.get("food"), dict) else ing.get("name"),
                    "unit_cost": float(price_per_g.get(int(ing.get("id")), median_price)) if ing.get("id") is not None else None,
                    "cost": (
                        float(ing.get("amount")) * float(price_per_g.get(int(ing.get("id")), median_price))
                        if (ing.get("id") is not None and ing.get("amount") is not None)
                        else None
                    ),
                }
                for ing in (r.get("ingredients", []) or [])
            ],
            "recipe_cost": float(recipe_cost[i]),
            "steps": int(steps[i]),
        }

    for day in range(M):
        td = time.time()
        print(f"  [seq] === Day {day+1}/{M} (A+B) ===", flush=True)

        # x[N, 2]: slot 0 = A, slot 1 = B
        gen = VariableGenerator()
        x = gen.array("Binary", (N, 2))

        # 使用済みレシピをコース別に固定（AはA履歴のみ、BはB履歴のみ）
        for idx in used_idxs_a:
            x[idx, 0] = 0
        for idx in used_idxs_b:
            x[idx, 1] = 0

        # --- 制約構築（M=2: slot0=A, slot1=B） ---

        # H1: カテゴリ（各スロットで主食=1, 主菜=1, etc.）
        h1 = build_h1_category(x, 2, cat_to_idxs, W["H1"])

        # H2: 栄養（各スロット独立、1日単位目標）
        h2 = build_h2_nutrition(x, 2, N, nut, NUT_KEYS, TARGET, W)

        # H3: コスト（各スロット独立、1日あたり目標）
        daily_target = {**TARGET, "cost": daily_cost_target}
        h3 = build_h3_cost(x, 2, N, recipe_cost, daily_target, W)

        # H4: A/B間でレシピ重複なし（各レシピは2スロット合わせて最大1回）
        h4 = build_h4_duplication(x, 2, N, W["H4"])

        # H5: ジャンル（各スロット内で同ジャンルペナルティ）
        h5 = build_h5_genre(x, 2, N, genres, H5_MODE, W["H5"])

        # H7: 隣接日多様性（前日のA+B全レシピとの類似度ペナルティ）
        if prev_chosen_idxs:
            h7 = build_h7_prev_day(x, N, prev_chosen_idxs, g, sim, top_neighbors, W["H7"])
        else:
            h7 = 0

        # H8: A+B合計工程数を total_steps_budget で直接制約
        combined_steps = sum([int(steps[i]) * (x[i, 0] + x[i, 1]) for i in range(N)])
        ts = max(1, total_steps_budget)
        h8 = float(W["H8"]) * ((1.0 / ts) * (combined_steps - ts)) ** 2

        # モデル構築 & 求解
        model = (h2 + h3 + h5 + h7 + h8) + (h1 + h4)
        result = solve(model, client)
        best = result.best
        vals = best.values

        # この日の選択を取得
        chosen_a = []
        chosen_b = []
        for i in range(N):
            try:
                if vals[x[i, 0]] == 1:
                    chosen_a.append(i)
            except (KeyError, TypeError):
                pass
            try:
                if vals[x[i, 1]] == 1:
                    chosen_b.append(i)
            except (KeyError, TypeError):
                pass

        # 蓄積（コース別に使用済み管理）
        used_idxs_a.update(chosen_a)
        used_idxs_b.update(chosen_b)
        prev_chosen_idxs = chosen_a + chosen_b
        all_day_chosen_a.append(chosen_a)
        all_day_chosen_b.append(chosen_b)

        print(f"  [seq] Day {day+1} done: A={len(chosen_a)}, B={len(chosen_b)} recipes, {time.time()-td:.2f}s", flush=True)

    print(f"  [timer] TOTAL sequential: {time.time()-t0:.2f}s (N={N}, M={M})", flush=True)

    # --- レスポンス構築 ---
    def build_plan(all_day_chosen):
        days = []
        daily_totals = []
        checks = {"per_day_category_counts": []}

        for r, chosen in enumerate(all_day_chosen):
            details = [get_recipe_detail(i) for i in chosen]

            tot = {"cost": 0.0}
            for key in NUT_KEYS:
                tot[key] = 0.0

            total_steps_val = 0
            for drec in details:
                tot["cost"] += float(drec["recipe_cost"])
                total_steps_val += drec["steps"]
                nutr = drec.get("nutritions", {}) or {}
                for key in NUT_KEYS:
                    tot[key] += float(nutr.get(key, 0.0) or 0.0)
            tot["steps"] = total_steps_val

            cnt = {}
            for c in DISPLAY_CAT_ORDER:
                cnt[CATEGORY_NAME.get(c, str(c))] = builtins.sum(1 for drec in details if drec["category"] == c)

            checks["per_day_category_counts"].append({"day": r + 1, "counts": cnt})
            days.append({"day": r + 1, "recipes": details})
            daily_totals.append({"day": r + 1, "totals": tot})

        total_cost_value = builtins.sum(day["totals"]["cost"] for day in daily_totals)
        return {
            "days": days,
            "daily_totals": daily_totals,
            "total_cost": float(total_cost_value),
        }, checks

    plan_a, checks_a = build_plan(all_day_chosen_a)
    plan_b, checks_b = build_plan(all_day_chosen_b)

    response = {
        "meta": {
            "M": M,
            "N_candidates": N,
            "target": TARGET,
            "weights": W,
            "h5_mode": H5_MODE,
            "topk_sim": topk_sim,
            "total_steps_budget": total_steps_budget,
            "solver": "sequential_unified",
        },
        "plan_a": plan_a,
        "plan_b": plan_b,
        "checks_a": checks_a,
        "checks_b": checks_b,
    }

    return response


def _solve_one_day_process(args):
    """1日分のA+B同時solve（ProcessPoolExecutor用トップレベル関数）。
    引数は辞書1つにまとめて渡す（pickleの都合）。
    """
    used_a_snapshot = args["used_a_snapshot"]
    used_b_snapshot = args["used_b_snapshot"]
    prev_chosen = args["prev_chosen"]
    next_chosen = args["next_chosen"]
    amplify_token = args["amplify_token"]
    client_type = args.get("client_type", "amplify_ae")
    toshiba_sqbm_token = args.get("toshiba_sqbm_token")
    toshiba_sqbm_url = args.get("toshiba_sqbm_url")
    N = args["N"]
    cat_to_idxs = args["cat_to_idxs"]
    W = args["W"]
    TARGET = args["TARGET"]
    nut = args["nut"]
    NUT_KEYS = args["NUT_KEYS"]
    recipe_cost = args["recipe_cost"]
    genres = args["genres"]
    H5_MODE = args["H5_MODE"]
    g = args["g"]
    sim = args["sim"]
    top_neighbors = args["top_neighbors"]
    steps = args["steps"]
    total_steps_budget = args["total_steps_budget"]
    daily_cost_target = args["daily_cost_target"]
    label = args.get("label", "")

    import os
    pid = os.getpid()

    gen = VariableGenerator()
    x = gen.array("Binary", (N, 2))

    for idx in used_a_snapshot:
        x[idx, 0] = 0
    for idx in used_b_snapshot:
        x[idx, 1] = 0

    t_build = time.time()

    h1 = build_h1_category(x, 2, cat_to_idxs, W["H1"])
    h2 = build_h2_nutrition(x, 2, N, nut, NUT_KEYS, TARGET, W)
    daily_target = {**TARGET, "cost": daily_cost_target}
    h3 = build_h3_cost(x, 2, N, recipe_cost, daily_target, W)
    h4 = build_h4_duplication(x, 2, N, W["H4"])
    h5 = build_h5_genre(x, 2, N, genres, H5_MODE, W["H5"])

    h7 = 0
    if prev_chosen:
        h7 += build_h7_prev_day(x, N, prev_chosen, g, sim, top_neighbors, W["H7"])
    if next_chosen:
        h7 += build_h7_prev_day(x, N, next_chosen, g, sim, top_neighbors, W["H7"])

    combined_steps = sum([int(steps[i]) * (x[i, 0] + x[i, 1]) for i in range(N)])
    ts = max(1, total_steps_budget)
    h8 = float(W["H8"]) * ((1.0 / ts) * (combined_steps - ts)) ** 2

    model = (h2 + h3 + h5 + h7 + h8) + (h1 + h4)
    print(f"    [pid={pid} {label}] model build: {time.time()-t_build:.2f}s", flush=True)

    if client_type == "toshiba_sqbm" and toshiba_sqbm_token:
        client = ToshibaSQBM2Client()
        client.token = toshiba_sqbm_token
        # url はクラウド版（annealing-cloud.com）では不要。AWS版のみ設定
        if toshiba_sqbm_url:
            client.url = toshiba_sqbm_url
        client.parameters.timeout = timedelta(milliseconds=3000)
        solver_name = "SQBM+"
    else:
        client = AmplifyAEClient()
        client.token = amplify_token
        client.parameters.time_limit_ms = timedelta(milliseconds=3000)
        solver_name = "AE"

    t_solve = time.time()
    try:
        result = solve(model, client)
        elapsed_solve = time.time() - t_solve
        print(f"    [pid={pid} {label}] solve ({solver_name}): {elapsed_solve:.2f}s", flush=True)
    except Exception as e:
        elapsed_solve = time.time() - t_solve
        if solver_name == "SQBM+":
            # SQBM+ 接続エラー → AE にフォールバック
            print(f"    [pid={pid} {label}] SQBM+ error ({e}), fallback to AE...", flush=True)
            client = AmplifyAEClient()
            client.token = amplify_token
            client.parameters.time_limit_ms = timedelta(milliseconds=3000)
            solver_name = "AE"
            t_solve = time.time()
            result = solve(model, client)
            elapsed_solve = time.time() - t_solve
            print(f"    [pid={pid} {label}] solve (AE fallback): {elapsed_solve:.2f}s", flush=True)
        else:
            raise

    if len(result) == 0 and client_type == "toshiba_sqbm":
        # SQBM+ で解なし → AE にフォールバック
        print(f"    [pid={pid} {label}] SQBM+ no feasible solution, fallback to AE...", flush=True)
        client = AmplifyAEClient()
        client.token = amplify_token
        client.parameters.time_limit_ms = timedelta(milliseconds=3000)
        t_solve = time.time()
        result = solve(model, client)
        elapsed_solve = time.time() - t_solve
        print(f"    [pid={pid} {label}] solve (AE fallback): {elapsed_solve:.2f}s", flush=True)

    best = result.best
    vals = best.values

    chosen_a = []
    chosen_b = []
    for i in range(N):
        try:
            if vals[x[i, 0]] == 1:
                chosen_a.append(i)
        except (KeyError, TypeError):
            pass
        try:
            if vals[x[i, 1]] == 1:
                chosen_b.append(i)
        except (KeyError, TypeError):
            pass

    return chosen_a, chosen_b


def _run_chain(chain_days, shared_args, client_type, confirmed_a, confirmed_b, lock, results_dict, label_prefix):
    """前方または後方チェーンを独立実行するワーカー関数。
    confirmed_a/b: multiprocessing.Manager().dict() — 確定済みレシピindex→day のマッピング
    lock: multiprocessing.Manager().Lock() — compare-and-write 用
    results_dict: multiprocessing.Manager().dict() — day_index -> (chosen_a, chosen_b)
    """
    import os
    pid = os.getpid()
    prev_chosen = []

    for day in chain_days:
        td = time.time()
        label = f"{label_prefix} Day{day+1}"

        # READ: 確定済みを除外リストとして取得
        with lock:
            used_a = set(confirmed_a.keys())
            used_b = set(confirmed_b.keys())

        args = {
            **shared_args,
            "used_a_snapshot": used_a,
            "used_b_snapshot": used_b,
            "prev_chosen": prev_chosen,
            "next_chosen": None,
            "label": label,
            "client_type": client_type,
        }

        while True:
            chosen_a, chosen_b = _solve_one_day_process(args)

            # COMPARE & WRITE (Lock内)
            with lock:
                current_a = set(confirmed_a.keys())
                current_b = set(confirmed_b.keys())
                collision_a = set(chosen_a) & current_a
                collision_b = set(chosen_b) & current_b

                if not collision_a and not collision_b:
                    # 衝突なし → 確定書き込み
                    for idx in chosen_a:
                        confirmed_a[idx] = day
                    for idx in chosen_b:
                        confirmed_b[idx] = day
                    results_dict[day] = (chosen_a, chosen_b)
                    print(f"    [pid={pid} {label}] committed: A={len(chosen_a)} B={len(chosen_b)}, {time.time()-td:.2f}s", flush=True)
                    break
                else:
                    # 衝突あり → 除外リスト更新して再solve
                    print(f"    [pid={pid} {label}] collision! A={collision_a}, B={collision_b}, re-solving...", flush=True)
                    used_a = set(confirmed_a.keys())
                    used_b = set(confirmed_b.keys())

            # 再solve用に除外リスト更新
            args["used_a_snapshot"] = used_a
            args["used_b_snapshot"] = used_b
            args["label"] = f"{label} re-solve"

        prev_chosen = chosen_a + chosen_b


def solve_menu_ab_speculative(
    recipes_raw,
    cost_raw,
    *,
    M: int,
    topk_sim: int,
    amplify_token: str,
    TARGET: dict,
    W: dict,
    total_steps_budget: int,
    H5_MODE: str = "practical",
    add_milk: bool = False,
    progress_queue=None,
):
    """投機的並列実行: 前方(Day0→)と後方(Day M-1→)をロックステップで同時solve。"""
    price_per_g, median_price = build_price_table(cost_raw)
    recipes, cats, genres, nut, recipe_cost, steps, X, NUT_KEYS = preprocess(recipes_raw, price_per_g, median_price)

    cat_to_idxs = {c: np.where(cats == c)[0].tolist() for c in sorted(set(cats))}
    for c in REQ_CATS + OPT_CATS:
        if len(cat_to_idxs.get(c, [])) == 0:
            raise ValueError(f"category {c} has no recipes.")

    t0 = time.time()
    sim, g, _d, top_neighbors = build_similarity(X, genres, M, topk_sim)
    N = len(recipes)
    print(f"  [timer] preprocess + similarity: {time.time()-t0:.2f}s", flush=True)

    # add_milk=True の場合、牛乳分の栄養素をTARGETから差し引いてQUBOを最適化
    if add_milk:
        milk_ratio = MILK_DATA["amount_ml"] / 100.0  # 200ml → 2.0
        TARGET = {
            **TARGET,
            "エネルギー": TARGET["エネルギー"] - MILK_DATA["nutritions"]["エネルギー"] * milk_ratio,
            "たんぱく質": TARGET["たんぱく質"] - MILK_DATA["nutritions"]["たんぱく質"] * milk_ratio,
            "脂質": TARGET["脂質"] - MILK_DATA["nutritions"]["脂質"] * milk_ratio,
            "ナトリウム": TARGET["ナトリウム"] - MILK_DATA["nutritions"]["ナトリウム"] * milk_ratio,
        }

    # cost は1日あたりの予算（フロントエンドで「1日あたり（1人）」として入力）
    daily_cost_target = float(TARGET["cost"])

    # 共有状態（メインスレッドがマージを管理）
    used_idxs_a = set()
    used_idxs_b = set()

    # 全日の結果を格納（日付順にアクセスするため辞書で）
    results_by_day = {}  # day_index -> (chosen_a, chosen_b)

    idx_to_recipe = {i: recipes[i] for i in range(N)}

    def get_recipe_detail(i: int):
        r = idx_to_recipe[i]
        return {
            "idx": int(i),
            "id": r.get("id", i),
            "title": r.get("title", f"recipe_{i}"),
            "category": int(r.get("category", -1)),
            "category_name": CATEGORY_NAME.get(int(r.get("category", -1)), str(r.get("category", -1))),
            "genre": int(r.get("genre", -1)),
            "nutritions": r.get("nutritions", {}) or {},
            "ingredients": [
                {
                    "food_id": int(ing.get("id")) if ing.get("id") is not None else None,
                    "amount_g": float(ing.get("amount")) if ing.get("amount") is not None else None,
                    "name": (ing.get("food") or {}).get("name") if isinstance(ing.get("food"), dict) else ing.get("name"),
                    "unit_cost": float(price_per_g.get(int(ing.get("id")), median_price)) if ing.get("id") is not None else None,
                    "cost": (
                        float(ing.get("amount")) * float(price_per_g.get(int(ing.get("id")), median_price))
                        if (ing.get("id") is not None and ing.get("amount") is not None)
                        else None
                    ),
                }
                for ing in (r.get("ingredients", []) or [])
            ],
            "recipe_cost": float(recipe_cost[i]),
            "steps": int(steps[i]),
        }

    def _build_day_event(d: int, chosen_a: list, chosen_b: list) -> dict:
        """1日分のSSEイベントデータを構築する（ストリーミング用）"""
        def _day_detail(chosen):
            details = [get_recipe_detail(i) for i in chosen]
            if add_milk:
                milk_ratio = MILK_DATA["amount_ml"] / 100.0
                details.append({
                    "idx": -1, "id": MILK_DATA["id"], "title": MILK_DATA["title"],
                    "category": MILK_DATA["category"], "category_name": MILK_DATA["category_name"],
                    "genre": MILK_DATA["genre"],
                    "nutritions": {k: v * milk_ratio for k, v in MILK_DATA["nutritions"].items()},
                    "ingredients": [], "recipe_cost": MILK_DATA["recipe_cost"], "steps": 0,
                })
            tot = {"cost": 0.0}
            for key in NUT_KEYS:
                tot[key] = 0.0
            for drec in details:
                tot["cost"] += float(drec["recipe_cost"])
                nutr = drec.get("nutritions", {}) or {}
                for key in NUT_KEYS:
                    tot[key] += float(nutr.get(key, 0.0) or 0.0)
            return {"day": d + 1, "recipes": details, "totals": tot}

        return {
            "event": "day",
            "day": d + 1,
            "plan_a": _day_detail(chosen_a),
            "plan_b": _day_detail(chosen_b),
        }

    # 共通引数（プロセス間で共有する読み取り専用データ）
    shared_args = {
        "N": N,
        "cat_to_idxs": cat_to_idxs,
        "W": W,
        "TARGET": TARGET,
        "nut": nut,
        "NUT_KEYS": NUT_KEYS,
        "recipe_cost": recipe_cost,
        "genres": genres,
        "H5_MODE": H5_MODE,
        "g": g,
        "sim": sim,
        "top_neighbors": top_neighbors,
        "steps": steps,
        "total_steps_budget": total_steps_budget,
        "daily_cost_target": daily_cost_target,
        "amplify_token": amplify_token,
        "toshiba_sqbm_token": os.environ.get("TOSHIBA_SQBM_TOKEN"),
        "toshiba_sqbm_url": os.environ.get("TOSHIBA_SQBM_URL"),
    }

    mid = M // 2

    # 前方チェーン: Day 0 ~ mid-1, 後方チェーン: Day M-1 ~ mid+1 (偶数) or mid (奇数)
    # 中央の残り: 偶数→mid, mid-1 の2日 / 奇数→mid の1日（後方チェーンに含めない）
    fwd_days = list(range(mid))                          # [0, 1, ..., mid-1]
    bwd_days = list(range(M - 1, mid, -1))               # [M-1, M-2, ..., mid+1]

    # multiprocessing.Manager で共有状態を作成
    import multiprocessing
    manager = multiprocessing.Manager()
    confirmed_a = manager.dict()   # recipe_idx -> day（Aコース確定済み）
    confirmed_b = manager.dict()   # recipe_idx -> day（Bコース確定済み）
    lock = manager.Lock()
    results_dict = manager.dict()  # day_index -> (chosen_a, chosen_b)

    # SQBM+ はトークンが設定されている場合のみ使用（クラウド版はURL不要）
    _sqbm_token = os.environ.get("TOSHIBA_SQBM_TOKEN")
    bwd_client_type = "toshiba_sqbm" if _sqbm_token else "amplify_ae"
    print(f"  [spec] fwd_days={[d+1 for d in fwd_days]}, bwd_days={[d+1 for d in bwd_days]}", flush=True)
    print(f"  [spec] fwd_client=amplify_ae, bwd_client={bwd_client_type}", flush=True)

    # ストリーミング用: 送信済み日数を追跡
    _stream_seen: set = set()

    def _emit_day(d: int):
        """results_dict[d] をキューに送信（未送信の場合のみ）"""
        if progress_queue is not None and d not in _stream_seen:
            _stream_seen.add(d)
            ca, cb = results_dict[d]
            progress_queue.put(_build_day_event(d, list(ca), list(cb)))

    # 前方(AE)と後方(SQBM+ or AE)を独立プロセスで実行
    with ProcessPoolExecutor(max_workers=2) as executor:
        fwd_future = executor.submit(
            _run_chain, fwd_days, shared_args, "amplify_ae",
            confirmed_a, confirmed_b, lock, results_dict, "fwd"
        )
        bwd_future = executor.submit(
            _run_chain, bwd_days, shared_args, bwd_client_type,
            confirmed_a, confirmed_b, lock, results_dict, "bwd"
        )

        if progress_queue is not None:
            # ポーリングして完了した日をリアルタイムに送信
            while not (fwd_future.done() and bwd_future.done()):
                for _d in list(results_dict.keys()):
                    _emit_day(_d)
                time.sleep(0.3)
            # 最終チェック
            for _d in list(results_dict.keys()):
                _emit_day(_d)

        fwd_future.result()
        bwd_future.result()

    # results_dict を通常の dict に変換
    results_by_day = dict(results_dict)

    # --- 中央の残り日を逐次solve ---
    # 前方最終日: mid-1, 後方最終日: mid+1
    # 残り: mid のみ（偶数Mなら mid は後方チェーンに含まれないので逐次）
    # 偶数M: bwd_days の最後が mid+1 なので mid が残る
    # 奇数M: bwd_days の最後が mid+1 なので mid が残る
    remaining_days = [d for d in range(M) if d not in results_by_day]

    if remaining_days:
        print(f"  [spec] === Remaining middle days: {[d+1 for d in remaining_days]} ===", flush=True)

        # 前方チェーン最終日の結果を prev_chosen に
        seq_prev_chosen = []
        if (remaining_days[0] - 1) in results_by_day:
            ca, cb = results_by_day[remaining_days[0] - 1]
            seq_prev_chosen = list(ca) + list(cb)

        for seq_day in remaining_days:
            ts = time.time()

            # next_chosen: 最後の残り日は後方チェーンとの接続
            next_chosen = None
            if seq_day == remaining_days[-1] and (seq_day + 1) in results_by_day:
                ca, cb = results_by_day[seq_day + 1]
                next_chosen = list(ca) + list(cb)

            print(f"  [spec] === Sequential Day {seq_day+1} (prev={'yes' if seq_prev_chosen else 'no'}, next={'yes' if next_chosen else 'no'}) ===", flush=True)

            with lock:
                used_a = set(confirmed_a.keys())
                used_b = set(confirmed_b.keys())

            seq_args = {
                **shared_args,
                "used_a_snapshot": used_a,
                "used_b_snapshot": used_b,
                "prev_chosen": seq_prev_chosen,
                "next_chosen": next_chosen,
                "label": f"seq Day{seq_day+1}",
                "client_type": "amplify_ae",
            }
            seq_a, seq_b = _solve_one_day_process(seq_args)

            with lock:
                for idx in seq_a:
                    confirmed_a[idx] = seq_day
                for idx in seq_b:
                    confirmed_b[idx] = seq_day
            results_by_day[seq_day] = (seq_a, seq_b)
            results_dict[seq_day] = (seq_a, seq_b)  # _emit_day が参照する manager.dict にも登録
            _emit_day(seq_day)
            seq_prev_chosen = seq_a + seq_b

            print(f"  [spec] Sequential Day {seq_day+1} done: A={len(seq_a)} B={len(seq_b)}, {time.time()-ts:.2f}s", flush=True)

    print(f"  [timer] TOTAL speculative: {time.time()-t0:.2f}s (N={N}, M={M})", flush=True)

    # --- レスポンス構築（日付順に並べ替え） ---
    all_day_chosen_a = [results_by_day[d][0] for d in range(M)]
    all_day_chosen_b = [results_by_day[d][1] for d in range(M)]

    def build_plan(all_day_chosen):
        days = []
        daily_totals = []
        checks = {"per_day_category_counts": []}

        for r, chosen in enumerate(all_day_chosen):
            details = [get_recipe_detail(i) for i in chosen]

            # add_milk=True の場合、牛乳を各日のレシピ末尾に追加
            if add_milk:
                milk_ratio = MILK_DATA["amount_ml"] / 100.0  # 2.0
                milk_detail = {
                    "idx": -1,
                    "id": MILK_DATA["id"],
                    "title": MILK_DATA["title"],
                    "category": MILK_DATA["category"],
                    "category_name": MILK_DATA["category_name"],
                    "genre": MILK_DATA["genre"],
                    "nutritions": {
                        k: v * milk_ratio for k, v in MILK_DATA["nutritions"].items()
                    },
                    "ingredients": [],
                    "recipe_cost": MILK_DATA["recipe_cost"],
                    "steps": 0,
                }
                details.append(milk_detail)

            tot = {"cost": 0.0}
            for key in NUT_KEYS:
                tot[key] = 0.0

            total_steps_val = 0
            for drec in details:
                tot["cost"] += float(drec["recipe_cost"])
                total_steps_val += drec["steps"]
                nutr = drec.get("nutritions", {}) or {}
                for key in NUT_KEYS:
                    tot[key] += float(nutr.get(key, 0.0) or 0.0)
            tot["steps"] = total_steps_val

            cnt = {}
            for c in DISPLAY_CAT_ORDER:
                cnt[CATEGORY_NAME.get(c, str(c))] = builtins.sum(1 for drec in details if drec["category"] == c)

            checks["per_day_category_counts"].append({"day": r + 1, "counts": cnt})
            days.append({"day": r + 1, "recipes": details})
            daily_totals.append({"day": r + 1, "totals": tot})

        total_cost_value = builtins.sum(day["totals"]["cost"] for day in daily_totals)
        return {
            "days": days,
            "daily_totals": daily_totals,
            "total_cost": float(total_cost_value),
        }, checks

    plan_a, checks_a = build_plan(all_day_chosen_a)
    plan_b, checks_b = build_plan(all_day_chosen_b)

    response = {
        "meta": {
            "M": M,
            "N_candidates": N,
            "target": TARGET,
            "weights": W,
            "h5_mode": H5_MODE,
            "topk_sim": topk_sim,
            "total_steps_budget": total_steps_budget,
            "solver": "speculative_parallel",
        },
        "plan_a": plan_a,
        "plan_b": plan_b,
        "checks_a": checks_a,
        "checks_b": checks_b,
    }

    return response


# ---- CORS設定 ----
CORS_ORIGIN = "*"  # 特定ドメインに絞るなら "https://example.com"

def _add_cors_headers(resp):
    resp.headers["Access-Control-Allow-Origin"] = CORS_ORIGIN
    resp.headers["Vary"] = "Origin"  # 将来 origin を絞る可能性があるなら有益
    resp.headers["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    resp.headers["Access-Control-Max-Age"] = "3600"
    return resp

@app.route("/optimize", methods=["POST", "OPTIONS"])
def optimize_kondate():
    # --- Preflight ---
    if request.method == "OPTIONS":
        resp = make_response("", 204)
        return _add_cors_headers(resp)
    # --- request body例 ---
    # {
    #   "M": 5,
    #   "cost": 1500.0,
    #   "school_id": "school_001",
    #   "target_year_month": "2026-03-01",
    #   "target_week": 1,
    #   "save_to_db": true,
    #   "add_milk": false
    # }
    body = request.get_json(silent=True) or {}

    M = int(body.get("M", 5))
    topk_sim = 12
    h5_mode = "practical"
    add_milk = bool(body.get("add_milk", False))

    total_steps_budget = int(body.get("total_steps_budget", 30))

    TARGET = {
        "エネルギー": 650.0,
        "たんぱく質": 20.0,
        "脂質": 18.0,
        "ナトリウム": 1000.0,
        "cost": int(body.get("cost", 1500.0)),   # M日合計
        "target_steps": int(body.get("target_steps", 10)),  # 1日あたり調理工程数目標（Aコース用）
    }

    W = {
        "H1": 80.0,
        "beta": {
            "エネルギー": 0.5,
            "たんぱく質": 0.3,
            "脂質": 0.5,
            "ナトリウム": 0.3,
        },
        "epsilon": 0.1,
        "H3": 0.1,
        "H4": 20.0,
        "H5": 0.2,
        "H7": 0.2,
        "H8": 50.0,
    }

    token = os.environ.get("AMPLIFY_TOKEN")
    if not token:
        return jsonify({"error": "AMPLIFY_TOKEN is not set in environment variables."}), 500

    school_id = body.get("school_id", "62059dce-db8f-4fde-b59a-444853efe5d8")

    try:
        total_start_time = time.time()
        recipes_raw, cost_raw = load_json_sources()

        result = solve_menu_ab_speculative(
                recipes_raw,
                cost_raw,
                M=M,
                topk_sim=topk_sim,
                amplify_token=token,
                TARGET=TARGET,
                W=W,
                total_steps_budget=total_steps_budget,
                H5_MODE=h5_mode,
                add_milk=add_milk,
            )

        total_time_sec = time.time() - total_start_time

        # フロントエンド互換性のため plan_a を plan、checks_a を checks としても公開
        result["plan"] = result.get("plan_a", {})
        result["checks"] = result.get("checks_a", {})

        # Amplify計算履歴を保存（常に保存）
        try:
            request_params = {
                "M": M,
                "cost": body.get("cost", 1500.0),
                "school_id": school_id,
                "start_date": body.get("start_date"),
                "add_milk": add_milk,
                "topk_sim": topk_sim,
                "h5_mode": h5_mode,
                "weights": W,
                "target": TARGET,
                "total_steps_budget": total_steps_budget,
            }

            plan_a = result.get("plan_a", {})
            num_variables = len(plan_a.get("days", [])) * 2  # A/Bコース × 日数
            solution_status = "feasible" if plan_a.get("days") else "infeasible"
            num_constraints = 8  # H1〜H8

            calculation_id = save_amplify_calculation_history(
                school_id=school_id,
                request_params=request_params,
                response_data=result,
                solver_time_sec=total_time_sec,
                total_time_sec=total_time_sec,
                num_variables=num_variables,
                num_constraints=num_constraints,
                objective_value=None,
                solution_status=solution_status
            )
            print(f"[INFO] Amplify calculation history saved: calculation_id={calculation_id}")
            result["calculation_id"] = calculation_id

        except Exception as calc_error:
            print(f"[ERROR] Failed to save Amplify calculation history: {str(calc_error)}")
            traceback.print_exc()
            result["calculation_save_error"] = str(calc_error)

        # データベースに献立を保存（オプション）
        save_to_db = body.get("save_to_db", False)
        print(f"[DEBUG] save_to_db: {save_to_db}")

        if save_to_db:
            print("[DEBUG] Starting database save...")
            # start_date: フロントエンドから直接受け取る（未指定時は当月1日にフォールバック）
            start_date_str = body.get("start_date")
            if not start_date_str:
                now = datetime.now()
                start_date_str = f"{now.year}-{now.month:02d}-01"
                print(f"[WARN] start_date が未指定のため当月1日をデフォルトに使用: {start_date_str}")
            print(f"[DEBUG] school_id: {school_id}, start_date: {start_date_str}")

            plan_a = result.get("plan_a", {})
            plan_b = result.get("plan_b", {})

            try:
                ids_a = save_menu_to_db(
                    school_id=school_id,
                    start_date=start_date_str,
                    plan_type="A",
                    plan=plan_a,
                )
                result["saved_menu_ids_a"] = ids_a
                print(f"[DEBUG] plan_a saved. ids={ids_a}")
            except Exception as db_error:
                print(f"[ERROR] Database save failed (plan_a): {str(db_error)}")
                traceback.print_exc()
                result["save_error_a"] = str(db_error)

            try:
                ids_b = save_menu_to_db(
                    school_id=school_id,
                    start_date=start_date_str,
                    plan_type="B",
                    plan=plan_b,
                )
                result["saved_menu_ids_b"] = ids_b
                print(f"[DEBUG] plan_b saved. ids={ids_b}")
            except Exception as db_error:
                print(f"[ERROR] Database save failed (plan_b): {str(db_error)}")
                traceback.print_exc()
                result["save_error_b"] = str(db_error)

        resp = jsonify(result)
        return _add_cors_headers(resp), 200

    except Exception as e:
        tb = traceback.format_exc()
        print(tb, file=sys.stderr, flush=True)
        resp = jsonify({"error": str(e), "traceback": tb})
        return _add_cors_headers(resp), 500

@app.route("/optimize-stream", methods=["POST", "OPTIONS"])
def optimize_stream():
    """SSEストリーミング版の献立最適化API。1日ごとに結果をリアルタイム送信する。"""
    if request.method == "OPTIONS":
        resp = make_response("", 204)
        return _add_cors_headers(resp)

    body = request.get_json(silent=True) or {}

    topk_sim = 12
    h5_mode = "practical"
    add_milk = bool(body.get("add_milk", False))
    total_steps_budget = int(body.get("total_steps_budget", 30))

    school_id   = body.get("school_id",   "62059dce-db8f-4fde-b59a-444853efe5d8")
    school_id_b = body.get("school_id_b", "b4e2f891-c7d3-4a56-9f18-2b3c4d5e6f7a")
    save_to_db = body.get("save_to_db", False)
    start_date_param = body.get("start_date")   # YYYY-MM-DD（フロントエンドから直接受け取る）
    end_date_param   = body.get("end_date")     # YYYY-MM-DD（終了日、指定時はMを自動計算）

    # M（最適化日数）の決定: end_date が指定されていれば学校給食提供日数を自動計算
    if end_date_param and start_date_param:
        M = count_school_days(start_date_param, end_date_param)
        if M <= 0:
            resp = jsonify({"error": "指定期間内に給食提供日がありません（土日・祝日のみの期間です）"})
            return _add_cors_headers(resp), 400
        print(f"[INFO] end_date={end_date_param} → M={M}日（土日・祝日除く）")
    else:
        M = int(body.get("M", 5))

    TARGET = {
        "エネルギー": 650.0,
        "たんぱく質": 20.0,
        "脂質": 18.0,
        "ナトリウム": 1000.0,
        "cost": int(body.get("cost", 1500.0)),
        "target_steps": int(body.get("target_steps", 10)),
    }
    W = {
        "H1": 80.0,
        "beta": {"エネルギー": 0.5, "たんぱく質": 0.3, "脂質": 0.5, "ナトリウム": 0.3},
        "epsilon": 0.1, "H3": 0.1, "H4": 20.0, "H5": 0.2, "H7": 0.2, "H8": 50.0,
    }

    token = os.environ.get("AMPLIFY_TOKEN")
    if not token:
        return jsonify({"error": "AMPLIFY_TOKEN is not set."}), 500

    progress_queue = std_queue.Queue()
    total_start_time = time.time()

    def run_solver():
        try:
            recipes_raw, cost_raw = load_json_sources()
            result = solve_menu_ab_speculative(
                recipes_raw, cost_raw,
                M=M, topk_sim=topk_sim, amplify_token=token,
                TARGET=TARGET, W=W, total_steps_budget=total_steps_budget,
                H5_MODE=h5_mode, add_milk=add_milk,
                progress_queue=progress_queue,
            )
            progress_queue.put({"event": "_solver_done", "result": result})
        except Exception as e:
            progress_queue.put({"event": "error", "message": str(e), "traceback": traceback.format_exc()})

    threading.Thread(target=run_solver, daemon=True).start()

    def generate():
        # フロントエンドがプログレスバーを初期化できるよう total_days を先行送信
        # school_days: 土日・祝日を除いた実際の提供日リスト（YYYY-MM-DD形式）
        _school_days = None
        if start_date_param:
            try:
                _school_days = [d.isoformat() for d in get_school_days(start_date_param, M)]
            except Exception:
                _school_days = None
        yield f"data: {json.dumps({'event': 'start', 'total_days': M, 'school_days': _school_days}, ensure_ascii=False)}\n\n"
        full_result = None
        try:
            while True:
                try:
                    item = progress_queue.get(timeout=300)
                except std_queue.Empty:
                    yield f"data: {json.dumps({'event': 'error', 'message': 'timeout'}, ensure_ascii=False)}\n\n"
                    return

                evt = item.get("event")
                if evt == "day":
                    yield f"data: {json.dumps(item, ensure_ascii=False)}\n\n"
                elif evt == "_solver_done":
                    full_result = item["result"]
                    break
                elif evt == "error":
                    yield f"data: {json.dumps({'event': 'error', 'message': item.get('message', 'unknown error')}, ensure_ascii=False)}\n\n"
                    return
        except GeneratorExit:
            return

        # DB保存・履歴保存（通常の /optimize と同じ処理）
        total_time_sec = time.time() - total_start_time
        full_result["plan"] = full_result.get("plan_a", {})
        full_result["checks"] = full_result.get("checks_a", {})

        try:
            request_params = {
                "M": M, "cost": body.get("cost", 1500.0),
                "school_id": school_id,
                "start_date": start_date_param, "end_date": end_date_param,
                "add_milk": add_milk, "topk_sim": topk_sim, "h5_mode": h5_mode,
                "weights": W, "target": TARGET, "total_steps_budget": total_steps_budget,
            }
            plan_a = full_result.get("plan_a", {})
            num_variables = len(plan_a.get("days", [])) * 2
            solution_status = "feasible" if plan_a.get("days") else "infeasible"
            calculation_id = save_amplify_calculation_history(
                school_id=school_id, request_params=request_params,
                response_data=full_result, solver_time_sec=total_time_sec,
                total_time_sec=total_time_sec, num_variables=num_variables,
                num_constraints=8, objective_value=None, solution_status=solution_status,
            )
            full_result["calculation_id"] = calculation_id
        except Exception as e:
            full_result["calculation_save_error"] = str(e)

        if save_to_db:
            # start_date: フロントエンドから直接受け取る（未指定時は当月1日にフォールバック）
            _start_date = start_date_param
            if not _start_date:
                now = datetime.now()
                _start_date = f"{now.year}-{now.month:02d}-01"
                print(f"[WARN] start_date が未指定のため当月1日をデフォルトに使用: {_start_date}")

            plan_a = full_result.get("plan_a", {})
            plan_b = full_result.get("plan_b", {})

            try:
                ids_a = save_menu_to_db(
                    school_id=school_id,
                    start_date=_start_date,
                    plan_type="A",
                    plan=plan_a,
                )
                full_result["saved_menu_ids_a"] = ids_a
                print(f"[INFO] plan_a saved for school_id={school_id}, ids={ids_a}")
            except Exception as db_e:
                full_result["save_error_a"] = str(db_e)
                print(f"[ERROR] Failed to save plan_a: {db_e}")

            try:
                ids_b = save_menu_to_db(
                    school_id=school_id_b,
                    start_date=_start_date,
                    plan_type="B",
                    plan=plan_b,
                )
                full_result["saved_menu_ids_b"] = ids_b
                print(f"[INFO] plan_b saved for school_id={school_id_b}, ids={ids_b}")
            except Exception as db_e:
                full_result["save_error_b"] = str(db_e)
                print(f"[ERROR] Failed to save plan_b: {db_e}")

        yield f"data: {json.dumps({'event': 'done', 'result': full_result}, ensure_ascii=False)}\n\n"

    resp = Response(stream_with_context(generate()), content_type="text/event-stream")
    resp.headers["Cache-Control"] = "no-cache"
    resp.headers["X-Accel-Buffering"] = "no"
    _add_cors_headers(resp)
    return resp


@app.route("/get_menu", methods=["GET", "POST", "OPTIONS"])
def get_menu():
    """
    保存された献立を日付範囲で取得するAPI（1日1レコード形式）

    Parameters:
        school_id (str)  : 小学校ID（UUID）
        start_date (str) : 取得開始日 YYYY-MM-DD（省略時: 当月1日）
        end_date (str)   : 取得終了日 YYYY-MM-DD（省略時: 当月末日）
        plan_type (str)  : 'A' または 'B'（省略時: 両方）
        target_year_month (str): YYYY-MM を指定するとその月全体を取得（start_date/end_date より優先）

    Response:
        {"menus": [{"menu_id", "target_date", "plan_type", "menu_data",
                    "total_cost", "total_nutrition", "created_at"}, ...]}
    """
    if request.method == "OPTIONS":
        return _add_cors_headers(jsonify({})), 200

    try:
        body = request.get_json() or {} if request.method == "POST" else request.args.to_dict()

        school_id = body.get("school_id", "62059dce-db8f-4fde-b59a-444853efe5d8")
        plan_type = body.get("plan_type")  # 'A', 'B', または None（両方）

        # 日付範囲の決定：target_year_month が指定されればその月全体を使用
        target_year_month = body.get("target_year_month")
        if target_year_month:
            ym = target_year_month[:7]  # YYYY-MM に正規化
            import calendar
            y, m = int(ym[:4]), int(ym[5:7])
            start_date_str = f"{y}-{m:02d}-01"
            last_day = calendar.monthrange(y, m)[1]
            end_date_str = f"{y}-{m:02d}-{last_day}"
        else:
            start_date_str = body.get("start_date")
            end_date_str = body.get("end_date")
            if not start_date_str:
                now = datetime.now()
                import calendar
                start_date_str = f"{now.year}-{now.month:02d}-01"
                last_day = calendar.monthrange(now.year, now.month)[1]
                end_date_str = end_date_str or f"{now.year}-{now.month:02d}-{last_day}"

        print(f"[DEBUG] get_menu: school_id={school_id}, {start_date_str}〜{end_date_str}, plan_type={plan_type}")

        conn = None
        try:
            conn = get_db_connection()
            cur = conn.cursor()

            if plan_type:
                cur.execute("""
                    SELECT school_menu_id, target_date, plan_type,
                           menu_data, total_cost, total_nutrition, created_at
                    FROM school_menus
                    WHERE school_id  = %s
                      AND target_date BETWEEN %s AND %s
                      AND plan_type  = %s
                      AND deleted_at IS NULL
                    ORDER BY target_date ASC, plan_type ASC
                """, (school_id, start_date_str, end_date_str, plan_type))
            else:
                cur.execute("""
                    SELECT school_menu_id, target_date, plan_type,
                           menu_data, total_cost, total_nutrition, created_at
                    FROM school_menus
                    WHERE school_id  = %s
                      AND target_date BETWEEN %s AND %s
                      AND deleted_at IS NULL
                    ORDER BY target_date ASC, plan_type ASC
                """, (school_id, start_date_str, end_date_str))

            rows = cur.fetchall()
            cur.close()

            menus = []
            for row in rows:
                menu_id, tdate, ptype, menu_data, total_cost, total_nutrition, created_at = row
                if isinstance(menu_data, str):
                    menu_data = json.loads(menu_data)
                if isinstance(total_nutrition, str):
                    total_nutrition = json.loads(total_nutrition)
                menus.append({
                    "menu_id":        menu_id,
                    "school_id":      school_id,
                    "target_date":    tdate.isoformat() if tdate else None,
                    "plan_type":      ptype,
                    "menu_data":      menu_data,
                    "total_cost":     total_cost,
                    "total_nutrition": total_nutrition,
                    "created_at":     created_at.isoformat() if created_at else None,
                })

            print(f"[DEBUG] Found {len(menus)} day-record(s)")
            resp = jsonify({"menus": menus})
            return _add_cors_headers(resp), 200

        except Exception as db_error:
            print(f"[ERROR] Database query failed: {str(db_error)}")
            traceback.print_exc()
            resp = jsonify({"error": f"Database error: {str(db_error)}"})
            return _add_cors_headers(resp), 500
        finally:
            if conn:
                conn.close()

    except Exception as e:
        print(f"[ERROR] get_menu failed: {str(e)}")
        traceback.print_exc()
        resp = jsonify({"error": str(e)})
        return _add_cors_headers(resp), 500


@app.route("/delete-menu", methods=["POST", "OPTIONS"])
def delete_menu():
    """
    指定日付の献立を論理削除するAPI
    Request: { school_id, target_date }  # target_date: "YYYY-MM-DD"
    """
    if request.method == "OPTIONS":
        return _add_cors_headers(jsonify({})), 200
    conn = None
    try:
        data = request.get_json()
        school_id   = data.get("school_id")
        target_date = data.get("target_date")

        if not school_id or not target_date:
            resp = jsonify({"error": "school_id と target_date は必須です"})
            return _add_cors_headers(resp), 400

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            UPDATE school_menus
            SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE school_id   = %s
              AND target_date = %s
              AND deleted_at IS NULL
        """, (school_id, target_date))
        deleted_count = cur.rowcount
        conn.commit()
        print(f"[INFO] delete_menu: date={target_date}, deleted={deleted_count}")
        resp = jsonify({"deleted_count": deleted_count, "target_date": target_date})
        return _add_cors_headers(resp), 200

    except Exception as e:
        print(f"[ERROR] delete_menu: {e}")
        traceback.print_exc()
        resp = jsonify({"error": str(e)})
        return _add_cors_headers(resp), 500
    finally:
        if conn:
            conn.close()


@app.route("/get-recipes", methods=["GET", "OPTIONS"])
def get_recipes():
    """
    指定されたIDのレシピを取得するAPI

    Parameters:
        id (str): レシピID（URLパラメータ）
    """
    if request.method == "OPTIONS":
        return _add_cors_headers(jsonify({})), 200

    recipe_id = None
    try:
        recipe_id = request.args.get("id")

        if not recipe_id:
            resp = jsonify({"error": "Parameter 'id' is required"})
            return _add_cors_headers(resp), 400

        recipe_file_path = Path(os.path.join(os.path.dirname(__file__), "recipe")) / f"{recipe_id}.json"

        if not recipe_file_path.exists():
            resp = jsonify({
                "error": f"Recipe with id '{recipe_id}' not found",
                "recipe_id": recipe_id
            })
            return _add_cors_headers(resp), 404

        recipe_data = json.loads(recipe_file_path.read_text(encoding="utf-8"))

        print(f"[DEBUG] Successfully loaded recipe id={recipe_id}")

        resp = jsonify(recipe_data)
        return _add_cors_headers(resp), 200

    except json.JSONDecodeError as e:
        print(f"[ERROR] JSON decode error for recipe id={recipe_id}: {str(e)}")
        resp = jsonify({
            "error": "Invalid JSON format in recipe file",
            "recipe_id": recipe_id
        })
        return _add_cors_headers(resp), 500
    except Exception as e:
        print(f"[ERROR] get_recipes failed: {str(e)}")
        traceback.print_exc()
        resp = jsonify({"error": str(e)})
        return _add_cors_headers(resp), 500


@app.route("/get-all-recipes", methods=["GET", "OPTIONS"])
def get_all_recipes():
    """
    全レシピ一覧を取得するAPI（PostgreSQLのrecipesテーブルから取得）
    """
    print("[DEBUG] get_all_recipes: Request received")

    if request.method == "OPTIONS":
        return _add_cors_headers(jsonify({})), 200

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        query = """
            SELECT
                recipe_id,
                recipe_name,
                category,
                genre,
                available_months,
                energy_kcal,
                protein_g,
                fat_g,
                salt_g,
                created_at,
                updated_at
            FROM recipes
            WHERE deleted_at IS NULL
            ORDER BY recipe_id
        """

        cursor.execute(query)
        rows = cursor.fetchall()
        print(f"[DEBUG] get_all_recipes: Fetched {len(rows)} rows from database")

        recipes = []
        for row in rows:
            recipe = {
                "recipe_id": row[0],
                "recipe_name": row[1],
                "category": row[2],
                "genre": row[3],
                "available_months": row[4],
                "nutrition": {
                    "energy_kcal": float(row[5]) if row[5] is not None else None,
                    "protein_g": float(row[6]) if row[6] is not None else None,
                    "fat_g": float(row[7]) if row[7] is not None else None,
                    "salt_g": float(row[8]) if row[8] is not None else None
                },
                "created_at": row[9].isoformat() if row[9] else None,
                "updated_at": row[10].isoformat() if row[10] else None
            }
            recipes.append(recipe)

        resp = jsonify({
            "recipes": recipes,
            "total_count": len(recipes)
        })
        return _add_cors_headers(resp), 200

    except psycopg2.Error as e:
        print(f"[ERROR] Database error in get_all_recipes: {str(e)}")
        traceback.print_exc()
        resp = jsonify({"error": "Database error", "details": str(e)})
        return _add_cors_headers(resp), 500
    except Exception as e:
        print(f"[ERROR] get_all_recipes failed: {str(e)}")
        traceback.print_exc()
        resp = jsonify({"error": str(e)})
        return _add_cors_headers(resp), 500
    finally:
        if conn:
            conn.close()


@app.route("/get-food-costs", methods=["GET", "OPTIONS"])
def get_food_costs():
    """
    食材価格一覧を取得するAPI
    """
    if request.method == "OPTIONS":
        return _add_cors_headers(jsonify({})), 200

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        default_school_id = '62059dce-db8f-4fde-b59a-444853efe5d8'

        query = """
            SELECT DISTINCT
                ri.food_id,
                ri.food_name,
                COALESCE(fc.price_per_gram, 0) as price_per_gram,
                fc.school_id
            FROM recipe_ingredients ri
            LEFT JOIN food_costs fc ON ri.food_id = fc.food_id AND fc.school_id = %s
            WHERE ri.deleted_at IS NULL
            ORDER BY ri.food_id
        """

        cursor.execute(query, (default_school_id,))
        rows = cursor.fetchall()

        food_costs = []
        for row in rows:
            food_cost = {
                "food_id": row[0],
                "food_name": row[1],
                "price_per_gram": float(row[2]) if row[2] is not None else 0.0,
                "school_id": row[3] if row[3] else None
            }
            food_costs.append(food_cost)

        print(f"[DEBUG] get_food_costs: Retrieved {len(food_costs)} food items")

        resp = jsonify({
            "food_costs": food_costs,
            "total_count": len(food_costs)
        })
        return _add_cors_headers(resp), 200

    except Exception as e:
        print(f"[ERROR] get_food_costs failed: {str(e)}")
        traceback.print_exc()
        resp = jsonify({"error": str(e)})
        return _add_cors_headers(resp), 500
    finally:
        if conn:
            conn.close()


@app.route("/update-food-cost", methods=["POST", "OPTIONS"])
def update_food_cost():
    """
    食材価格を更新するAPI
    """
    if request.method == "OPTIONS":
        return _add_cors_headers(jsonify({})), 200

    conn = None
    try:
        data = request.get_json()
        food_id = data.get("food_id")
        school_id = data.get("school_id", "62059dce-db8f-4fde-b59a-444853efe5d8")
        price_per_gram = data.get("price_per_gram")

        if food_id is None or price_per_gram is None:
            resp = jsonify({"error": "food_id and price_per_gram are required"})
            return _add_cors_headers(resp), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        query = """
            INSERT INTO food_costs (food_id, school_id, price_per_gram, created_at, updated_at)
            VALUES (%s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (food_id, school_id)
            DO UPDATE SET
                price_per_gram = EXCLUDED.price_per_gram,
                updated_at = CURRENT_TIMESTAMP
        """

        cursor.execute(query, (food_id, school_id, price_per_gram))
        conn.commit()

        print(f"[DEBUG] Updated food_cost: food_id={food_id}, price={price_per_gram}")

        resp = jsonify({"success": True, "food_id": food_id, "price_per_gram": price_per_gram})
        return _add_cors_headers(resp), 200

    except Exception as e:
        print(f"[ERROR] update_food_cost failed: {str(e)}")
        traceback.print_exc()
        if conn:
            conn.rollback()
        resp = jsonify({"error": str(e)})
        return _add_cors_headers(resp), 500
    finally:
        if conn:
            conn.close()


@app.route("/get-recipe-detail/<int:recipe_id>", methods=["GET", "OPTIONS"])
def get_recipe_detail(recipe_id):
    """
    レシピの詳細情報を取得（recipes + recipe_ingredients + recipe_workload）
    """
    if request.method == "OPTIONS":
        return _add_cors_headers(jsonify({})), 200

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT recipe_id, recipe_name, category, genre, standard_prep_time, standard_difficulty,
                   available_months, energy_kcal, protein_g, fat_g, salt_g
            FROM recipes
            WHERE recipe_id = %s AND deleted_at IS NULL
        """, (recipe_id,))

        recipe_row = cursor.fetchone()
        if not recipe_row:
            resp = jsonify({"error": "Recipe not found"})
            return _add_cors_headers(resp), 404

        recipe = {
            "recipe_id": recipe_row[0],
            "recipe_name": recipe_row[1],
            "category": recipe_row[2],
            "genre": recipe_row[3],
            "standard_prep_time": recipe_row[4],
            "standard_difficulty": recipe_row[5],
            "available_months": recipe_row[6] or [],
            "energy_kcal": float(recipe_row[7]) if recipe_row[7] else None,
            "protein_g": float(recipe_row[8]) if recipe_row[8] else None,
            "fat_g": float(recipe_row[9]) if recipe_row[9] else None,
            "salt_g": float(recipe_row[10]) if recipe_row[10] else None,
        }

        cursor.execute("""
            SELECT food_id, food_name, amount_g
            FROM recipe_ingredients
            WHERE recipe_id = %s AND deleted_at IS NULL
            ORDER BY food_id
        """, (recipe_id,))

        ingredients = []
        for row in cursor.fetchall():
            ingredients.append({
                "food_id": row[0],
                "food_name": row[1],
                "amount_g": float(row[2]) if row[2] else 0
            })

        cursor.execute("""
            SELECT step_id, step_name, cooking_time_min, use_heat, use_oven,
                   required_staff_count, is_parallel_ok, requires_prep_day_before
            FROM recipe_workload
            WHERE recipe_id = %s
            ORDER BY step_id
        """, (recipe_id,))

        workload_steps = []
        for row in cursor.fetchall():
            workload_steps.append({
                "step_id": row[0],
                "step_name": row[1],
                "cooking_time_min": row[2],
                "use_heat": row[3],
                "use_oven": row[4],
                "required_staff_count": row[5],
                "is_parallel_ok": row[6],
                "requires_prep_day_before": row[7]
            })

        result = {
            "recipe": recipe,
            "ingredients": ingredients,
            "workload_steps": workload_steps
        }

        resp = jsonify(result)
        return _add_cors_headers(resp), 200

    except Exception as e:
        print(f"[ERROR] get_recipe_detail failed: {str(e)}")
        traceback.print_exc()
        resp = jsonify({"error": str(e)})
        return _add_cors_headers(resp), 500
    finally:
        if conn:
            conn.close()


@app.route("/update-recipe", methods=["POST", "OPTIONS"])
def update_recipe():
    """
    レシピ情報を更新（recipes + recipe_ingredients + recipe_workload）
    """
    if request.method == "OPTIONS":
        return _add_cors_headers(jsonify({})), 200

    conn = None
    try:
        data = request.get_json()
        recipe_id = data.get("recipe_id")
        recipe_data = data.get("recipe", {})
        ingredients_data = data.get("ingredients", [])
        workload_data = data.get("workload_steps", [])

        if not recipe_id:
            resp = jsonify({"error": "recipe_id is required"})
            return _add_cors_headers(resp), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        # recipesテーブル更新
        if recipe_data:
            update_fields = []
            update_values = []

            for key in ["recipe_name", "category", "genre", "standard_prep_time", "standard_difficulty",
                       "available_months", "energy_kcal", "protein_g", "fat_g", "salt_g"]:
                if key in recipe_data:
                    update_fields.append(f"{key} = %s")
                    update_values.append(recipe_data[key])

            if update_fields:
                update_fields.append("updated_at = CURRENT_TIMESTAMP")
                query = f"UPDATE recipes SET {', '.join(update_fields)} WHERE recipe_id = %s"
                update_values.append(recipe_id)
                cursor.execute(query, tuple(update_values))

        # recipe_ingredients更新（既存を論理削除して再挿入）
        if ingredients_data is not None:
            cursor.execute("""
                UPDATE recipe_ingredients
                SET deleted_at = CURRENT_TIMESTAMP
                WHERE recipe_id = %s AND deleted_at IS NULL
            """, (recipe_id,))

            for ing in ingredients_data:
                cursor.execute("""
                    INSERT INTO recipe_ingredients (recipe_id, food_name, amount_g, created_at, updated_at)
                    VALUES (%s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """, (recipe_id, ing.get("food_name"), ing.get("amount_g")))

        # recipe_workload更新（既存を削除して再挿入）
        if workload_data is not None:
            cursor.execute("DELETE FROM recipe_workload WHERE recipe_id = %s", (recipe_id,))

            for step in workload_data:
                cursor.execute("""
                    INSERT INTO recipe_workload
                    (recipe_id, step_name, cooking_time_min, use_heat, use_oven,
                     required_staff_count, is_parallel_ok, requires_prep_day_before)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    recipe_id,
                    step.get("step_name"),
                    step.get("cooking_time_min"),
                    step.get("use_heat", False),
                    step.get("use_oven", False),
                    step.get("required_staff_count"),
                    step.get("is_parallel_ok", True),
                    step.get("requires_prep_day_before", False)
                ))

        conn.commit()
        print(f"[DEBUG] Updated recipe: recipe_id={recipe_id}")

        resp = jsonify({"success": True, "recipe_id": recipe_id})
        return _add_cors_headers(resp), 200

    except Exception as e:
        print(f"[ERROR] update_recipe failed: {str(e)}")
        traceback.print_exc()
        if conn:
            conn.rollback()
        resp = jsonify({"error": str(e)})
        return _add_cors_headers(resp), 500
    finally:
        if conn:
            conn.close()


@app.route("/add-food", methods=["POST", "OPTIONS"])
def add_food():
    """
    新規食材を追加するAPI
    - recipe_ingredients テーブルに食材情報を追加（recipe_id は NULL: スタンドアロン食材）
    - food_costs テーブルに初期価格を設定
    """
    if request.method == "OPTIONS":
        return _add_cors_headers(jsonify({})), 200

    conn = None
    try:
        data = request.get_json() or {}
        food_name = data.get("food_name", "").strip()
        school_id = data.get("school_id")
        price_per_gram = data.get("price_per_gram", 0.0)
        food_color_class = data.get("food_color_class")  # 1=赤, 2=黄, 3=緑 (任意)

        if not food_name:
            resp = jsonify({"error": "food_name is required"})
            return _add_cors_headers(resp), 400
        if not school_id:
            resp = jsonify({"error": "school_id is required"})
            return _add_cors_headers(resp), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        # recipe_ingredients に食材を追加（recipe_id は NULL = スタンドアロン食材）
        cursor.execute("""
            INSERT INTO recipe_ingredients (food_name, food_color_class, created_at, updated_at)
            VALUES (%s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING food_id
        """, (food_name, food_color_class if food_color_class else None))

        result = cursor.fetchone()
        new_food_id = result[0]

        # food_costs に初期価格を設定
        cursor.execute("""
            INSERT INTO food_costs (food_id, school_id, price_per_gram, created_at, updated_at)
            VALUES (%s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (food_id, school_id)
            DO UPDATE SET
                price_per_gram = EXCLUDED.price_per_gram,
                updated_at = CURRENT_TIMESTAMP
        """, (new_food_id, school_id, float(price_per_gram)))

        conn.commit()
        print(f"[DEBUG] Added new food: food_id={new_food_id}, food_name={food_name}, school_id={school_id}")

        resp = jsonify({
            "success": True,
            "food_id": new_food_id,
            "food_name": food_name,
            "price_per_gram": float(price_per_gram),
            "school_id": school_id,
        })
        return _add_cors_headers(resp), 201

    except Exception as e:
        print(f"[ERROR] add_food failed: {str(e)}")
        traceback.print_exc()
        if conn:
            conn.rollback()
        resp = jsonify({"error": str(e)})
        return _add_cors_headers(resp), 500
    finally:
        if conn:
            conn.close()


@app.route("/add-recipe", methods=["POST", "OPTIONS"])
def add_recipe():
    """
    新規レシピを追加するAPI
    - recipes テーブルにレシピ基本情報を追加
    - recipe_ingredients テーブルに食材を追加
    - recipe_workload テーブルに調理工程を追加
    """
    if request.method == "OPTIONS":
        return _add_cors_headers(jsonify({})), 200

    conn = None
    try:
        data = request.get_json() or {}
        recipe_data = data.get("recipe", {})
        ingredients_data = data.get("ingredients", [])
        workload_data = data.get("workload_steps", [])

        recipe_name = recipe_data.get("recipe_name", "").strip()
        if not recipe_name:
            resp = jsonify({"error": "recipe_name is required"})
            return _add_cors_headers(resp), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        # recipes テーブルに挿入
        cursor.execute("""
            INSERT INTO recipes
                (recipe_name, category, genre, energy_kcal, protein_g, fat_g, salt_g,
                 steps, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING recipe_id
        """, (
            recipe_name,
            recipe_data.get("category") or None,
            recipe_data.get("genre") or None,
            recipe_data.get("energy_kcal") or None,
            recipe_data.get("protein_g") or None,
            recipe_data.get("fat_g") or None,
            recipe_data.get("salt_g") or None,
            len(workload_data),
        ))
        row = cursor.fetchone()
        if row is None:
            raise Exception("Failed to insert recipe")
        new_recipe_id = row[0]

        # recipe_ingredients に食材を追加
        for ing in ingredients_data:
            if ing.get("food_name"):
                cursor.execute("""
                    INSERT INTO recipe_ingredients (recipe_id, food_name, amount_g, created_at, updated_at)
                    VALUES (%s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """, (new_recipe_id, ing["food_name"], ing.get("amount_g", 0)))

        # recipe_workload に調理工程を追加
        for step in workload_data:
            if step.get("step_name"):
                cursor.execute("""
                    INSERT INTO recipe_workload
                        (recipe_id, step_name, cooking_time_min, use_heat, use_oven,
                         required_staff_count, is_parallel_ok, requires_prep_day_before)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    new_recipe_id,
                    step["step_name"],
                    step.get("cooking_time_min", 0),
                    step.get("use_heat", False),
                    step.get("use_oven", False),
                    step.get("required_staff_count"),
                    step.get("is_parallel_ok", True),
                    step.get("requires_prep_day_before", False),
                ))

        conn.commit()
        print(f"[DEBUG] Added new recipe: recipe_id={new_recipe_id}, recipe_name={recipe_name}")

        resp = jsonify({"success": True, "recipe_id": new_recipe_id, "recipe_name": recipe_name})
        return _add_cors_headers(resp), 201

    except Exception as e:
        print(f"[ERROR] add_recipe failed: {str(e)}")
        traceback.print_exc()
        if conn:
            conn.rollback()
        resp = jsonify({"error": str(e)})
        return _add_cors_headers(resp), 500
    finally:
        if conn:
            conn.close()


@app.route("/import-food-costs", methods=["POST", "OPTIONS"])
def import_food_costs():
    """
    CSVから変換された食材価格行を一括でインポートするAPI。
    food_id あり → food_costs を UPSERT、food_id なし → recipe_ingredients に INSERT して food_costs に UPSERT。
    リクエスト: { "school_id": "...", "rows": [ {food_id?, food_name, price_per_gram}, ... ] }
    レスポンス: { "success_count": N, "error_count": M, "errors": [...], "items": [...] }
    """
    if request.method == "OPTIONS":
        return _add_cors_headers(jsonify({})), 200

    conn = None
    try:
        data = request.get_json() or {}
        school_id = data.get("school_id", "62059dce-db8f-4fde-b59a-444853efe5d8")
        rows = data.get("rows", [])

        if not rows:
            resp = jsonify({"error": "rows is required"})
            return _add_cors_headers(resp), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        success_count = 0
        error_count = 0
        errors = []
        items = []

        for row in rows:
            try:
                food_name = (row.get("food_name") or "").strip()
                price_str = row.get("price_per_gram")
                if price_str in (None, ""):
                    raise ValueError("price_per_gram が空です")
                price = float(price_str)

                if row.get("food_id"):
                    food_id = int(row["food_id"])
                    # food_costs を UPSERT
                    cursor.execute("""
                        INSERT INTO food_costs (food_id, school_id, price_per_gram, created_at, updated_at)
                        VALUES (%s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        ON CONFLICT (food_id, school_id)
                        DO UPDATE SET
                            price_per_gram = EXCLUDED.price_per_gram,
                            updated_at = CURRENT_TIMESTAMP
                    """, (food_id, school_id, price))
                    items.append({"food_id": food_id, "food_name": food_name, "price_per_gram": price})
                    print(f"[import-food-costs] UPSERT food_id={food_id} price={price}")
                else:
                    if not food_name:
                        raise ValueError("food_name は新規追加の際に必須です")
                    # recipe_ingredients に新規食材を追加
                    cursor.execute("""
                        INSERT INTO recipe_ingredients (food_name, created_at, updated_at)
                        VALUES (%s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        RETURNING food_id
                    """, (food_name,))
                    new_food_id = cursor.fetchone()[0]
                    # food_costs に価格を設定
                    cursor.execute("""
                        INSERT INTO food_costs (food_id, school_id, price_per_gram, created_at, updated_at)
                        VALUES (%s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        ON CONFLICT (food_id, school_id)
                        DO UPDATE SET
                            price_per_gram = EXCLUDED.price_per_gram,
                            updated_at = CURRENT_TIMESTAMP
                    """, (new_food_id, school_id, price))
                    items.append({"food_id": new_food_id, "food_name": food_name, "price_per_gram": price})
                    print(f"[import-food-costs] INSERT food_id={new_food_id} name={food_name}")

                success_count += 1

            except Exception as row_err:
                error_count += 1
                label = row.get("food_name") or row.get("food_id") or "?"
                errors.append(f"{label}: {str(row_err)}")
                print(f"[import-food-costs] ERROR row={label}: {row_err}")

        conn.commit()

        resp = jsonify({
            "success_count": success_count,
            "error_count": error_count,
            "errors": errors,
            "items": items,
        })
        return _add_cors_headers(resp), 200

    except Exception as e:
        print(f"[ERROR] import_food_costs failed: {str(e)}")
        traceback.print_exc()
        if conn:
            conn.rollback()
        resp = jsonify({"error": str(e)})
        return _add_cors_headers(resp), 500
    finally:
        if conn:
            conn.close()


@app.route("/import-recipes", methods=["POST", "OPTIONS"])
def import_recipes():
    """
    CSVから変換されたレシピ行を一括でインポートするAPI。
    recipe_id あり → UPDATE、recipe_id なし → INSERT。
    リクエスト: { "rows": [ {recipe_id?, recipe_name, category, genre, energy_kcal, protein_g, fat_g, salt_g}, ... ] }
    レスポンス: { "success_count": N, "error_count": M, "errors": [...] }
    """
    if request.method == "OPTIONS":
        return _add_cors_headers(jsonify({})), 200

    conn = None
    try:
        data = request.get_json() or {}
        rows = data.get("rows", [])

        if not rows:
            resp = jsonify({"error": "rows is required"})
            return _add_cors_headers(resp), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        success_count = 0
        error_count = 0
        errors = []

        for row in rows:
            try:
                recipe_id = row.get("recipe_id")
                recipe_name = (row.get("recipe_name") or "").strip()

                def _val(key):
                    v = row.get(key)
                    return float(v) if v not in (None, "") else None

                if recipe_id:
                    # UPDATE
                    cursor.execute("""
                        UPDATE recipes
                        SET recipe_name = %s,
                            category    = %s,
                            genre       = %s,
                            energy_kcal = %s,
                            protein_g   = %s,
                            fat_g       = %s,
                            salt_g      = %s,
                            updated_at  = CURRENT_TIMESTAMP
                        WHERE recipe_id = %s AND deleted_at IS NULL
                    """, (
                        recipe_name or None,
                        row.get("category") or None,
                        row.get("genre") or None,
                        _val("energy_kcal"),
                        _val("protein_g"),
                        _val("fat_g"),
                        _val("salt_g"),
                        int(recipe_id),
                    ))
                    print(f"[import-recipes] UPDATE recipe_id={recipe_id}")
                else:
                    # INSERT
                    if not recipe_name:
                        raise ValueError("recipe_name is required for new records")
                    cursor.execute("""
                        INSERT INTO recipes
                            (recipe_name, category, genre, energy_kcal, protein_g, fat_g, salt_g,
                             created_at, updated_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        RETURNING recipe_id
                    """, (
                        recipe_name,
                        row.get("category") or None,
                        row.get("genre") or None,
                        _val("energy_kcal"),
                        _val("protein_g"),
                        _val("fat_g"),
                        _val("salt_g"),
                    ))
                    new_id = cursor.fetchone()[0]
                    print(f"[import-recipes] INSERT recipe_id={new_id} name={recipe_name}")

                success_count += 1

            except Exception as row_err:
                error_count += 1
                label = row.get("recipe_name") or row.get("recipe_id") or "?"
                errors.append(f"{label}: {str(row_err)}")
                print(f"[import-recipes] ERROR row={label}: {row_err}")

        conn.commit()

        resp = jsonify({
            "success_count": success_count,
            "error_count": error_count,
            "errors": errors,
        })
        return _add_cors_headers(resp), 200

    except Exception as e:
        print(f"[ERROR] import_recipes failed: {str(e)}")
        traceback.print_exc()
        if conn:
            conn.rollback()
        resp = jsonify({"error": str(e)})
        return _add_cors_headers(resp), 500
    finally:
        if conn:
            conn.close()


@app.route("/delete-food", methods=["POST", "OPTIONS"])
def delete_food():
    """
    食材を削除するAPI（recipe_ingredients / food_costs の soft delete）
    """
    if request.method == "OPTIONS":
        return _add_cors_headers(jsonify({})), 200

    conn = None
    try:
        data = request.get_json() or {}
        food_id = data.get("food_id")
        if not food_id:
            resp = jsonify({"error": "food_id is required"})
            return _add_cors_headers(resp), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE recipe_ingredients
            SET deleted_at = CURRENT_TIMESTAMP
            WHERE food_id = %s AND deleted_at IS NULL
        """, (food_id,))

        conn.commit()
        resp = jsonify({"success": True, "food_id": food_id})
        return _add_cors_headers(resp), 200

    except Exception as e:
        print(f"[ERROR] delete_food failed: {str(e)}")
        traceback.print_exc()
        if conn:
            conn.rollback()
        resp = jsonify({"error": str(e)})
        return _add_cors_headers(resp), 500
    finally:
        if conn:
            conn.close()


@app.route("/delete-recipe", methods=["POST", "OPTIONS"])
def delete_recipe():
    """
    レシピを論理削除するAPI（recipes.deleted_at を設定）
    """
    if request.method == "OPTIONS":
        return _add_cors_headers(jsonify({})), 200

    conn = None
    try:
        data = request.get_json() or {}
        recipe_id = data.get("recipe_id")
        if not recipe_id:
            resp = jsonify({"error": "recipe_id is required"})
            return _add_cors_headers(resp), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE recipes
            SET deleted_at = CURRENT_TIMESTAMP
            WHERE recipe_id = %s AND deleted_at IS NULL
        """, (recipe_id,))

        if cursor.rowcount == 0:
            resp = jsonify({"error": "レシピが見つかりません"})
            return _add_cors_headers(resp), 404

        conn.commit()
        resp = jsonify({"success": True, "recipe_id": recipe_id})
        return _add_cors_headers(resp), 200

    except Exception as e:
        print(f"[ERROR] delete_recipe failed: {str(e)}")
        traceback.print_exc()
        if conn:
            conn.rollback()
        resp = jsonify({"error": str(e)})
        return _add_cors_headers(resp), 500
    finally:
        if conn:
            conn.close()


@app.route("/get-holidays", methods=["GET", "OPTIONS"])
def get_holidays():
    """
    祝日リストを返すAPI。
    JAPANESE_HOLIDAYS を "YYYY-MM-DD" 文字列の配列として返す。

    Query params:
        year (int, optional): 指定した年の祝日のみ返す。未指定時は全件返す。
    """
    if request.method == "OPTIONS":
        return _add_cors_headers(jsonify({})), 200

    try:
        year_param = request.args.get("year")
        if year_param:
            year_int = int(year_param)
            holidays = sorted(
                d.isoformat() for d in JAPANESE_HOLIDAYS if d.year == year_int
            )
        else:
            holidays = sorted(d.isoformat() for d in JAPANESE_HOLIDAYS)

        resp = jsonify({"holidays": holidays})
        return _add_cors_headers(resp), 200

    except Exception as e:
        print(f"[ERROR] get_holidays failed: {str(e)}")
        resp = jsonify({"error": str(e)})
        return _add_cors_headers(resp), 500


@app.route("/dashboard-stats", methods=["GET", "OPTIONS"])
def dashboard_stats():
    """
    ダッシュボード用の統計データを返すAPI。

    - 最新月のサマリー（総コスト・平均栄養価・再利用率・ジャンル多様性）
    - 過去12ヶ月の月別推移（コスト・エネルギー・たんぱく質・脂質）

    Query params:
        school_id (str): 小学校ID（UUID）。未指定時はAコースのID。
    """
    if request.method == "OPTIONS":
        return _add_cors_headers(jsonify({})), 200

    conn = None
    try:
        school_id = request.args.get("school_id", "62059dce-db8f-4fde-b59a-444853efe5d8")

        conn = get_db_connection()
        cur = conn.cursor()

        # ------------------------------------------------
        # 1. 月別推移データ（過去12ヶ月）
        # ------------------------------------------------
        cur.execute("""
            SELECT
                TO_CHAR(DATE_TRUNC('month', target_date), 'YYYY-MM') AS month,
                COUNT(*) AS serving_days,
                SUM(total_cost) AS total_cost,
                ROUND(AVG(total_cost)::numeric, 0) AS avg_cost,
                ROUND(AVG((total_nutrition->>'エネルギー')::numeric), 1) AS avg_energy,
                ROUND(AVG((total_nutrition->>'たんぱく質')::numeric), 2) AS avg_protein,
                ROUND(AVG((total_nutrition->>'脂質')::numeric), 2) AS avg_fat,
                ROUND(AVG((total_nutrition->>'ナトリウム')::numeric), 1) AS avg_sodium
            FROM school_menus
            WHERE school_id = %s
              AND deleted_at IS NULL
              AND target_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months'
            GROUP BY DATE_TRUNC('month', target_date)
            ORDER BY DATE_TRUNC('month', target_date)
        """, (school_id,))

        trend_rows = cur.fetchall()
        monthly_trends = []
        for row in trend_rows:
            month_str = row[0]  # "YYYY-MM"
            m = int(month_str[5:7])
            monthly_trends.append({
                "month": month_str,
                "label": f"{m}月",
                "serving_days": int(row[1]),
                "total_cost": int(row[2]) if row[2] else 0,
                "avg_cost": float(row[3]) if row[3] else 0,
                "avg_energy": float(row[4]) if row[4] else 0,
                "avg_protein": float(row[5]) if row[5] else 0,
                "avg_fat": float(row[6]) if row[6] else 0,
                "avg_sodium": float(row[7]) if row[7] else 0,
            })

        # ------------------------------------------------
        # 2. サマリー（過去12ヶ月全体の集計）
        # ------------------------------------------------
        summary = None
        if monthly_trends:
            total_cost = builtins.sum(t["total_cost"] for t in monthly_trends)
            serving_days = builtins.sum(t["serving_days"] for t in monthly_trends)

            target_cost_per_day = 300  # 1日あたりの目標コスト（円）
            target_cost = serving_days * target_cost_per_day
            accuracy = round(max(0.0, 100.0 - abs(total_cost - target_cost) / target_cost * 100), 1) \
                if target_cost > 0 else 0.0

            # 加重平均（各月の提供日数で重み付け）
            if serving_days > 0:
                avg_energy = round(
                    builtins.sum(t["avg_energy"] * t["serving_days"] for t in monthly_trends) / serving_days, 1
                )
                avg_protein = round(
                    builtins.sum(t["avg_protein"] * t["serving_days"] for t in monthly_trends) / serving_days, 2
                )
                avg_fat = round(
                    builtins.sum(t["avg_fat"] * t["serving_days"] for t in monthly_trends) / serving_days, 2
                )
                avg_sodium = round(
                    builtins.sum(t["avg_sodium"] * t["serving_days"] for t in monthly_trends) / serving_days, 1
                )
                avg_salt = round(avg_sodium * 2.54 / 1000, 2)
            else:
                avg_energy = 0.0
                avg_protein = 0.0
                avg_fat = 0.0
                avg_salt = 0.0

            # レシピ再利用率（過去12ヶ月全体で同じrecipe_idが複数回登場する割合）
            cur.execute("""
                SELECT
                    COUNT(r->>'id') AS total_count,
                    COUNT(DISTINCT r->>'id') AS unique_count
                FROM school_menus,
                LATERAL jsonb_array_elements(menu_data->'recipes') AS r
                WHERE school_id = %s
                  AND deleted_at IS NULL
                  AND target_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months'
                  AND r->>'id' IS NOT NULL
            """, (school_id,))
            reuse_row = cur.fetchone()
            total_count = int(reuse_row[0]) if reuse_row and reuse_row[0] else 0
            unique_count = int(reuse_row[1]) if reuse_row and reuse_row[1] else 0
            reuse_rate = round((total_count - unique_count) / total_count * 100, 1) \
                if total_count > 0 else 0.0

            # ジャンル多様性（過去12ヶ月全体のユニークジャンル数 / 全5ジャンル）
            cur.execute("""
                SELECT COUNT(DISTINCT r->>'genre') AS unique_genres
                FROM school_menus,
                LATERAL jsonb_array_elements(menu_data->'recipes') AS r
                WHERE school_id = %s
                  AND deleted_at IS NULL
                  AND target_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months'
                  AND r->>'genre' IS NOT NULL
                  AND (r->>'genre')::int >= 0
            """, (school_id,))
            genre_row = cur.fetchone()
            unique_genres = int(genre_row[0]) if genre_row and genre_row[0] else 0
            genre_diversity = round(unique_genres / 5 * 100, 1)  # 0〜4の5ジャンルで正規化

            # 表示ラベル用の期間（データのある最古月〜最新月）
            period_from = monthly_trends[0]["month"]
            period_to = monthly_trends[-1]["month"]

            summary = {
                "period_from": period_from,
                "period_to": period_to,
                "total_cost": total_cost,
                "target_cost": target_cost,
                "optimization_accuracy": accuracy,
                "avg_energy": avg_energy,
                "avg_protein": avg_protein,
                "avg_fat": avg_fat,
                "avg_salt": avg_salt,
                "recipe_reuse_rate": reuse_rate,
                "genre_diversity": genre_diversity,
                "serving_days": serving_days,
            }

        cur.close()
        resp = jsonify({
            "summary": summary,
            "monthly_trends": monthly_trends,
        })
        return _add_cors_headers(resp), 200

    except Exception as e:
        print(f"[ERROR] dashboard_stats failed: {str(e)}")
        traceback.print_exc()
        resp = jsonify({"error": str(e)})
        return _add_cors_headers(resp), 500
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    app.run(debug=True, use_reloader=False, host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))
