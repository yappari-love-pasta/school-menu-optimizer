# import functions_framework

# @functions_framework.http
# def hello_http(request):
#     """HTTP Cloud Function.
#     Args:
#         request (flask.Request): The request object.
#         <https://flask.palletsprojects.com/en/1.1.x/api/#incoming-request-data>
#     Returns:
#         The response text, or any set of values that can be turned into a
#         Response object using `make_response`
#         <https://flask.palletsprojects.com/en/1.1.x/api/#flask.make_response>.
#     """
#     request_json = request.get_json(silent=True)
#     request_args = request.args

#     if request_json and 'name' in request_json:
#         name = request_json['name']
#     elif request_args and 'name' in request_args:
#         name = request_args['name']
#     else:
#         name = 'World'
#     return 'Hello {}!'.format(name)

import os
import json
from pathlib import Path
from collections import defaultdict
from datetime import datetime

import numpy as np
from flask import Flask, request, jsonify, make_response
app = Flask(__name__)
from amplify import VariableGenerator, sum, solve, AmplifyAEClient

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


# ============
# JSON入力（どちらか片方でOK）
# 1) ファイルから読む場合：RECIPE_JSON_PATH / COST_JSON_PATH を使う
# 2) ベタ打ち文字列の場合：RECIPES_JSON_STR / COST_JSON_STR を使う
# ============
RECIPE_JSON_PATH = "reciept.json"
COST_JSON_PATH   = "reciept-cost.json"


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
            db=os.getenv("DB_NAME", "school_menu_db")
        )
        return conn
    else:
        # 従来の TCP/IP 接続（ローカル開発環境 or VPC Connector 経由）
        print(f"[INFO] Connecting to PostgreSQL via TCP/IP: {os.getenv('DB_HOST', 'localhost')}")
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST", "localhost"),
            port=os.getenv("DB_PORT", "5432"),
            database=os.getenv("DB_NAME", "school_menu_db"),
            user=os.getenv("DB_USER", "postgres"),
            password=os.getenv("DB_PASSWORD", "")
        )
        return conn


def save_menu_to_db(school_id, target_year_month, target_week, menu_data, total_cost, total_nutrition_avg):
    """
    献立データをschool_menusテーブルに保存

    Args:
        school_id: 小学校ID
        target_year_month: 対象年月（VARCHAR(7)、YYYY-MM形式、例: "2026-03"）
        target_week: 対象週（1〜5、NULLも可）
        menu_data: 献立データ（JSONB）
        total_cost: 合計コスト（円）
        total_nutrition_avg: 平均栄養価（JSONB）

    Returns:
        menu_id: 保存された献立ID
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # JSONデータを文字列に変換（ダブルクォートで正しくシリアライズ）
        import json
        menu_data_json = json.dumps(menu_data, ensure_ascii=False)
        total_nutrition_avg_json = json.dumps(total_nutrition_avg, ensure_ascii=False)

        # school_menusテーブルに挿入
        cur.execute("""
            INSERT INTO school_menus
                (school_id, target_year_month, target_week, menu_data, total_cost, total_nutrition_avg, created_at)
            VALUES
                (%s, %s, %s, %s::jsonb, %s, %s::jsonb, CURRENT_TIMESTAMP)
            RETURNING school_menu_id
        """, (
            school_id,
            target_year_month,
            target_week,
            menu_data_json,
            total_cost,
            total_nutrition_avg_json
        ))

        result = cur.fetchone()
        if result is None:
            raise Exception("Failed to insert menu data")

        menu_id = result[0]
        conn.commit()
        cur.close()

        return menu_id

    except Exception as e:
        if conn:
            conn.rollback()
        raise e
    finally:
        if conn:
            conn.close()

 
 


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
    X = np.zeros((N, K), dtype=float)  # 食材amountベクトル

    # フロント表示用に recipe_id を拾えるなら拾う（なければ idx を使う）
    recipe_ids = []

    for i, r in enumerate(recipes):
        recipe_ids.append(r.get("id", i))
        titles.append(r.get("title", f"recipe_{i}"))
        cats[i] = int(r.get("category", -1))
        genres[i] = int(r.get("genre", -1))

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

    # df（表示しやすい中間表）
    df = {
        "idx": np.arange(N),
        "recipe_id": recipe_ids,
        "title": titles,
        "category": cats,
        "category_name": [CATEGORY_NAME.get(int(c), str(c)) for c in cats],
        "genre": genres,
        "cost": recipe_cost,
        "エネルギー": nut[:, 0],
        "たんぱく質": nut[:, 1],
        "脂質": nut[:, 2],
        "ナトリウム": nut[:, 3],
    }

    return recipes, df, cats, genres, nut, recipe_cost, X, NUT_KEYS


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
    d = np.zeros((M, M), dtype=np.int8)
    for r in range(M):
        for rp in range(M):
            if abs(r - rp) == 1:
                d[r, rp] = 1

    # top neighbors
    N = X.shape[0]
    top_neighbors = []
    for i in range(N):
        idxs = np.argsort(-sim[i])
        nbrs = [int(j) for j in idxs[: topk + 1] if j != i][:topk]
        top_neighbors.append(nbrs)

    return sim, g, d, top_neighbors


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
):
    price_per_g, median_price = build_price_table(cost_raw)
    recipes, df, cats, genres, nut, recipe_cost, X, NUT_KEYS = preprocess(recipes_raw, price_per_g, median_price)

    # カテゴリindex集合
    cat_to_idxs = {c: np.where(cats == c)[0].tolist() for c in sorted(set(cats))}
    for c in REQ_CATS + OPT_CATS:
        if len(cat_to_idxs.get(c, [])) == 0:
            raise ValueError(f"category {c} has no recipes. CATEGORY_NAME/REQ_CATS/OPT_CATS mapping mismatch.")

    sim, g, d, top_neighbors = build_similarity(X, genres, M, topk_sim)
    N = len(recipes)

    # 変数
    gen = VariableGenerator()
    x = gen.array("Binary", (N, M))

    H = 0

    # H1：主食・主菜は=1 / 他は<=1
    H1 = 0
    for r in range(M):
        for c in REQ_CATS:
            idxs = cat_to_idxs[c]
            Sx = sum([x[i, r] for i in idxs])
            H1 += (Sx - 1) ** 2
        for c in OPT_CATS:
            idxs = cat_to_idxs[c]
            Sx = sum([x[i, r] for i in idxs])
            H1 += Sx * (Sx - 1)  # <=1
    H += float(W["H1"]) * H1

    # H2：栄養（各日）
    H2 = 0
    for r in range(M):
        for k_idx, key in enumerate(NUT_KEYS):
            coef = nut[:, k_idx]
            Sx = sum([float(coef[i]) * x[i, r] for i in range(N)])
            H2 += (Sx - float(TARGET[key])) ** 2
    H += float(W["H2"]) * H2

    # H3：M日合計コスト
    total_cost_expr = sum([float(recipe_cost[i]) * x[i, r] for r in range(M) for i in range(N)])
    H3 = (total_cost_expr - float(TARGET["cost"])) ** 2
    H += float(W["H3"]) * H3

    # H4：同一レシピ重複抑制（期間）
    H4 = 0
    for i in range(N):
        Sx = sum([x[i, r] for r in range(M)])
        H4 += Sx * (Sx - 1)
    H += float(W["H4"]) * H4

    # H5：同日ジャンル制御（practical推奨：同ジャンルを罰→多様化）
    H5 = 0
    if H5_MODE == "paper":
        pairs = [(i, j) for i in range(N) for j in range(i + 1, N) if genres[i] != genres[j]]
    elif H5_MODE == "practical":
        pairs = [(i, j) for i in range(N) for j in range(i + 1, N) if genres[i] == genres[j]]
    else:
        raise ValueError("H5_MODE must be 'paper' or 'practical'.")

    for r in range(M):
        for (i, j) in pairs:
            H5 += x[i, r] * x[j, r]
    H += float(W["H5"]) * H5

    # H7：隣接日多様性（g + sim）
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
    H += float(W["H7"]) * H7

    # solve
    client = AmplifyAEClient()
    client.token = amplify_token
    # client.parameters.timeout = 10000
    result = solve(H, client)
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
        }

    days = []
    daily_totals = []

    # カテゴリ別カウント（チェック用）
    checks = {"per_day_category_counts": []}

    for r in range(M):
        chosen = [i for i in range(N) if vals[x[i, r]] == 1]
        details = [get_recipe_detail(i) for i in chosen]

        # 日別集計（選ばれた分だけ合計）
        tot = {"cost": 0.0}
        for key in NUT_KEYS:
            tot[key] = 0.0

        for drec in details:
            tot["cost"] += float(drec["recipe_cost"])
            nutr = drec.get("nutritions", {}) or {}
            for key in NUT_KEYS:
                tot[key] += float(nutr.get(key, 0.0) or 0.0)

        # チェック：カテゴリごとに何個選ばれてるか
        cnt = {}
        for c in (REQ_CATS + OPT_CATS):
            cnt[CATEGORY_NAME.get(c, str(c))] = sum(1 for drec in details if drec["category"] == c)

        checks["per_day_category_counts"].append({"day": r + 1, "counts": cnt})

        days.append({"day": r + 1, "recipes": details})
        daily_totals.append({"day": r + 1, "totals": tot})

    total_cost_value = sum(x["totals"]["cost"] for x in daily_totals)

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
    #   "save_to_db": true
    # }
    body = request.get_json(silent=True) or {}

    M = int(body.get("M", 5))
    topk_sim = 12
    h5_mode = "practical"

    TARGET = {
        "エネルギー": 650.0,
        "たんぱく質": 20.0,
        "脂質": 18.0,
        "ナトリウム": 1000.0,
        "cost": int(body.get("cost", 1500.0)),   # M日合計
    }

    W = {
        "H1": 80.0,
        "H2": 0.03,
        "H3": 0.006,
        "H4": 20.0,
        "H5": 0.2,
        "H7": 0.2,
    }

    token = os.getenv("AMPLIFY_TOKEN")
    if not token:
        return jsonify({"error": "AMPLIFY_TOKEN is not set in environment variables."}), 500

    try:
        recipes_raw, cost_raw = load_json_sources()

        result = solve_menu(
            recipes_raw,
            cost_raw,
            M=M,
            topk_sim=topk_sim,
            amplify_token=token,
            TARGET=TARGET,
            W=W,
            H5_MODE=h5_mode,
        )

        # データベースに保存（オプション）
        save_to_db = body.get("save_to_db", False)
        print(f"[DEBUG] save_to_db: {save_to_db}")  # デバッグログ

        if save_to_db:
            print("[DEBUG] Starting database save...")  # デバッグログ
            school_id = 1  # 固定値（横須賀市小学校）
            target_year_month = body.get("target_year_month")
            target_week = body.get("target_week")  # フロントエンドから受け取る（1〜5、NULLも可）

            if not target_year_month:
                # target_year_monthが指定されていない場合は現在の年月を使用
                now = datetime.now()
                target_year_month = f"{now.year}-{now.month:02d}"
            else:
                # YYYY-MM-DD形式の場合はYYYY-MMに変換
                if len(target_year_month) == 10:  # YYYY-MM-DD
                    target_year_month = target_year_month[:7]  # YYYY-MM

            print(f"[DEBUG] school_id: {school_id}, target_year_month: {target_year_month}, target_week: {target_week}")  # デバッグログ

            # 平均栄養価を計算
            total_nutrition_avg = {}
            if "plan" in result and "daily_totals" in result["plan"]:
                daily_totals = result["plan"]["daily_totals"]
                if len(daily_totals) > 0:
                    # 各栄養素の平均を計算
                    nutrition_keys = ["エネルギー", "たんぱく質", "脂質", "ナトリウム"]
                    for key in nutrition_keys:
                        total = sum(day["totals"].get(key, 0) for day in daily_totals if "totals" in day)
                        total_nutrition_avg[key] = round(float(total) / len(daily_totals), 2)

            print(f"[DEBUG] total_nutrition_avg: {total_nutrition_avg}")  # デバッグログ

            # データベースに保存
            try:
                # total_costを整数に変換（データベースのINT型に合わせる）
                total_cost_value = result.get("plan", {}).get("total_cost", 0)
                total_cost_int = int(round(float(total_cost_value)))

                menu_id = save_menu_to_db(
                    school_id=school_id,
                    target_year_month=target_year_month,
                    target_week=target_week,
                    menu_data=result,
                    total_cost=total_cost_int,
                    total_nutrition_avg=total_nutrition_avg
                )
                print(f"[DEBUG] Successfully saved to database. menu_id: {menu_id}")  # デバッグログ

                # レスポンスにmenu_idを追加
                result["saved_menu_id"] = menu_id
            except Exception as db_error:
                print(f"[ERROR] Database save failed: {str(db_error)}")  # エラーログ
                import traceback
                traceback.print_exc()  # 詳細なスタックトレースを出力
                # エラーが発生してもレスポンスは返す（保存失敗を通知）
                result["save_error"] = str(db_error)

        resp = jsonify(result)
        return _add_cors_headers(resp), 200

    except Exception as e:
        resp = jsonify({"error": str(e)})
        return _add_cors_headers(resp), 500


@app.route("/get_menu", methods=["GET", "POST", "OPTIONS"])
def get_menu():
    """
    保存された献立を取得するAPI

    Parameters:
        school_id (int): 小学校ID（デフォルト: 1）
        target_year_month (str): 対象年月（YYYY-MM形式、例: "2026-03"、デフォルト: 当月）
        target_week (int): 対象週（1〜5、省略可）

    Returns:
        JSON: 献立データ
    """
    if request.method == "OPTIONS":
        return _add_cors_headers(jsonify({})), 200

    try:
        # リクエストパラメータを取得
        if request.method == "POST":
            body = request.get_json() or {}
        else:  # GET
            body = request.args.to_dict()

        # school_idを取得（デフォルト: 1）
        school_id = int(body.get("school_id", 1))

        # target_year_monthを取得（デフォルト: 当月）
        target_year_month = body.get("target_year_month")
        if not target_year_month:
            from datetime import datetime
            now = datetime.now()
            target_year_month = f"{now.year}-{now.month:02d}"
        else:
            # YYYY-MM-DD形式の場合はYYYY-MMに変換
            if len(target_year_month) == 10:  # YYYY-MM-DD
                target_year_month = target_year_month[:7]  # YYYY-MM

        # target_weekを取得（オプション）
        target_week = body.get("target_week")
        if target_week is not None:
            target_week = int(target_week)

        print(f"[DEBUG] Getting menu for school_id={school_id}, target_year_month={target_year_month}, target_week={target_week}")

        # データベースから献立を取得
        conn = None
        try:
            conn = get_db_connection()
            cur = conn.cursor()

            # target_weekが指定されている場合は週単位で検索、なければ月全体のすべての週を検索
            if target_week is not None:
                # 指定された週の献立を取得（1件のみ）
                cur.execute("""
                    SELECT school_menu_id, menu_data, total_cost, total_nutrition_avg, target_week, created_at
                    FROM school_menus
                    WHERE school_id = %s AND target_year_month = %s AND target_week = %s
                    ORDER BY created_at DESC
                    LIMIT 1
                """, (school_id, target_year_month, target_week))

                result = cur.fetchone()
                cur.close()

                if result:
                    menu_id, menu_data, total_cost, total_nutrition_avg, result_target_week, created_at = result

                    # JSON文字列をパース（pg8000の場合は既にdictになっている可能性あり）
                    if isinstance(menu_data, str):
                        import json
                        menu_data = json.loads(menu_data)
                    if isinstance(total_nutrition_avg, str):
                        import json
                        total_nutrition_avg = json.loads(total_nutrition_avg)

                    response_data = {
                        "menu_id": menu_id,
                        "school_id": school_id,
                        "target_year_month": target_year_month,
                        "target_week": result_target_week,
                        "menu_data": menu_data,
                        "total_cost": total_cost,
                        "total_nutrition_avg": total_nutrition_avg,
                        "created_at": created_at.isoformat() if created_at else None
                    }

                    # デバッグ: 返却するデータの日数を確認
                    days_count = 0
                    if menu_data and isinstance(menu_data, dict):
                        plan = menu_data.get("plan", {})
                        if isinstance(plan, dict):
                            days = plan.get("days", [])
                            if isinstance(days, list):
                                days_count = len(days)

                    print(f"[DEBUG] Found menu_id={menu_id}, target_week={result_target_week}, returning {days_count} days of menu data")
                    resp = jsonify(response_data)
                    return _add_cors_headers(resp), 200
                else:
                    print(f"[DEBUG] No menu found for specific week")
                    resp = jsonify({
                        "menu_id": None,
                        "school_id": school_id,
                        "target_year_month": target_year_month,
                        "target_week": target_week,
                        "menu_data": None,
                        "total_cost": None,
                        "total_nutrition_avg": None,
                        "created_at": None
                    })
                    return _add_cors_headers(resp), 200
            else:
                # 月全体のすべての週の献立を取得（複数レコード）
                cur.execute("""
                    SELECT school_menu_id, menu_data, total_cost, total_nutrition_avg, target_week, created_at
                    FROM school_menus
                    WHERE school_id = %s AND target_year_month = %s
                    ORDER BY
                        CASE WHEN target_week IS NULL THEN 0 ELSE target_week END ASC,
                        created_at DESC
                """, (school_id, target_year_month))

                results = cur.fetchall()
                cur.close()

                if results:
                    # 複数レコードを配列で返す
                    menus = []
                    for result in results:
                        menu_id, menu_data, total_cost, total_nutrition_avg, result_target_week, created_at = result

                        # JSON文字列をパース（pg8000の場合は既にdictになっている可能性あり）
                        if isinstance(menu_data, str):
                            import json
                            menu_data = json.loads(menu_data)
                        if isinstance(total_nutrition_avg, str):
                            import json
                            total_nutrition_avg = json.loads(total_nutrition_avg)

                        menu_item = {
                            "menu_id": menu_id,
                            "school_id": school_id,
                            "target_year_month": target_year_month,
                            "target_week": result_target_week,
                            "menu_data": menu_data,
                            "total_cost": total_cost,
                            "total_nutrition_avg": total_nutrition_avg,
                            "created_at": created_at.isoformat() if created_at else None
                        }
                        menus.append(menu_item)

                    print(f"[DEBUG] Found {len(menus)} menu(s) for {target_year_month}")
                    resp = jsonify({"menus": menus})
                    return _add_cors_headers(resp), 200
                else:
                    print(f"[DEBUG] No menu found for the month")
                    resp = jsonify({"menus": []})
                    return _add_cors_headers(resp), 200

        except Exception as db_error:
            print(f"[ERROR] Database query failed: {str(db_error)}")
            import traceback
            traceback.print_exc()
            resp = jsonify({"error": f"Database error: {str(db_error)}"})
            return _add_cors_headers(resp), 500
        finally:
            if conn:
                conn.close()

    except Exception as e:
        print(f"[ERROR] get_menu failed: {str(e)}")
        import traceback
        traceback.print_exc()
        resp = jsonify({"error": str(e)})
        return _add_cors_headers(resp), 500


if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))
