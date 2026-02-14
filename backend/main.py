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

import numpy as np
from flask import Flask, request, jsonify, make_response
app = Flask(__name__)
from amplify import VariableGenerator, sum, solve, AmplifyAEClient


# ============
# JSON入力（どちらか片方でOK）
# 1) ファイルから読む場合：RECIPE_JSON_PATH / COST_JSON_PATH を使う
# 2) ベタ打ち文字列の場合：RECIPES_JSON_STR / COST_JSON_STR を使う
# ============
RECIPE_JSON_PATH = "reciept.json"
COST_JSON_PATH   = "reciept-cost.json"

 
 


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
    #   "cost": 1500.0
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

        resp = jsonify(result)
        return _add_cors_headers(resp), 200

    except Exception as e:
        resp = jsonify({"error": str(e)})
        return _add_cors_headers(resp), 500

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))
