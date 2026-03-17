-- recipe_workloadテーブルへのINSERT文
-- 生成日時: 2026-02-25
-- 各レシピの調理工程に基づく実用的なサンプルデータ

BEGIN;

-- recipe_id: 1, とりたま煮（副菜・和風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (1, '材料の下準備', 10, FALSE, FALSE, 1, TRUE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (1, '煮込み調理', 20, TRUE, FALSE, 1, FALSE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (1, '盛り付け', 5, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 2, おひたし（副菜・和風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (2, '野菜の洗浄', 5, FALSE, FALSE, 1, TRUE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (2, '茹で作業', 10, TRUE, FALSE, 1, FALSE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (2, '水切り・調味', 5, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 3, カレーライス（主食・洋風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (3, '野菜のカット', 15, FALSE, FALSE, 2, TRUE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (3, '炒め・煮込み', 40, TRUE, FALSE, 1, FALSE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (3, 'ご飯の炊飯', 60, TRUE, FALSE, 1, TRUE, TRUE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (3, '盛り付け', 10, FALSE, FALSE, 2, TRUE, FALSE);

-- recipe_id: 4, たきこみごはん（主食・和風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (4, '具材の下準備', 15, FALSE, FALSE, 1, TRUE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (4, '炊飯', 60, TRUE, FALSE, 1, TRUE, TRUE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (4, '盛り付け', 5, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 5, ごはん（主食・和風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (5, '米の洗浄・浸水', 10, FALSE, FALSE, 1, TRUE, TRUE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (5, '炊飯', 50, TRUE, FALSE, 1, TRUE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (5, '盛り付け', 5, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 6, こぎつねずし（主食・和風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (6, '油揚げの下準備', 10, TRUE, FALSE, 1, FALSE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (6, 'ご飯の炊飯', 50, TRUE, FALSE, 1, TRUE, TRUE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (6, '酢飯作成', 10, FALSE, FALSE, 1, TRUE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (6, '成形・盛り付け', 15, FALSE, FALSE, 2, TRUE, FALSE);

-- recipe_id: 7, ミックスフルーツ（デザート・洋風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (7, 'フルーツカット', 10, FALSE, FALSE, 1, TRUE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (7, '盛り付け', 5, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 8, マカロニグラタン（主菜・洋風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (8, 'マカロニ茹で', 15, TRUE, FALSE, 1, FALSE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (8, 'ホワイトソース作成', 20, TRUE, FALSE, 1, FALSE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (8, 'オーブン焼き', 25, FALSE, TRUE, 1, FALSE, FALSE);

-- recipe_id: 9, ツナそぼろごはん（主食・和風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (9, 'ご飯の炊飯', 50, TRUE, FALSE, 1, TRUE, TRUE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (9, 'ツナそぼろ調理', 15, TRUE, FALSE, 1, FALSE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (9, '盛り付け', 5, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 10, みそドレッシングサラダ（副菜・洋風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (10, '野菜のカット・洗浄', 10, FALSE, FALSE, 1, TRUE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (10, 'ドレッシング作成', 5, FALSE, FALSE, 1, TRUE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (10, '盛り付け', 5, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 11, 中華風おひたし（副菜・和風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (11, '野菜の下準備', 5, FALSE, FALSE, 1, TRUE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (11, '茹で作業', 8, TRUE, FALSE, 1, FALSE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (11, '調味・盛り付け', 5, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 12, はやし煮（主菜・洋風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (12, '野菜・肉のカット', 15, FALSE, FALSE, 1, TRUE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (12, '炒め・煮込み', 35, TRUE, FALSE, 1, FALSE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (12, '盛り付け', 5, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 13, 豚汁（汁物・和風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (13, '具材のカット', 15, FALSE, FALSE, 1, TRUE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (13, '煮込み', 25, TRUE, FALSE, 1, FALSE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (13, '味噌溶き・配膳', 5, TRUE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 14, ぶどうパン（主食・洋風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (14, 'オーブン加熱', 15, FALSE, TRUE, 1, FALSE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (14, '配膳準備', 5, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 15, 麦ごはん（主食・和風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (15, '米・麦の洗浄', 10, FALSE, FALSE, 1, TRUE, TRUE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (15, '炊飯', 50, TRUE, FALSE, 1, TRUE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (15, '盛り付け', 5, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 16, 生揚げと野菜のそぼろ煮（主菜・和風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (16, '材料のカット', 10, FALSE, FALSE, 1, TRUE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (16, '炒め・煮込み', 20, TRUE, FALSE, 1, FALSE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (16, '盛り付け', 5, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 17, コーンチャウダー（汁物・洋風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (17, '野菜のカット', 10, FALSE, FALSE, 1, TRUE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (17, '炒め・煮込み', 20, TRUE, FALSE, 1, FALSE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (17, '配膳', 5, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 18, もやしのサラダ（副菜・洋風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (18, 'もやしの洗浄', 5, FALSE, FALSE, 1, TRUE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (18, '茹で・水切り', 8, TRUE, FALSE, 1, FALSE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (18, '調味・盛り付け', 5, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 19, ソース焼きそば（主食・和風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (19, '具材のカット', 10, FALSE, FALSE, 1, TRUE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (19, '炒め調理', 15, TRUE, FALSE, 2, FALSE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (19, '盛り付け', 5, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 20, ミートソーススパゲッティー（主食・洋風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (20, 'ミートソース作成', 30, TRUE, FALSE, 1, FALSE, TRUE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (20, 'パスタ茹で', 12, TRUE, FALSE, 1, FALSE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (20, '盛り付け', 5, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 21, いわしのたつた揚げ（主菜・和風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (21, '魚の下処理', 15, FALSE, FALSE, 2, TRUE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (21, '揚げ調理', 20, TRUE, FALSE, 1, FALSE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (21, '盛り付け', 5, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 22, ごまあえ（副菜・和風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (22, '野菜の下準備', 5, FALSE, FALSE, 1, TRUE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (22, '茹で作業', 8, TRUE, FALSE, 1, FALSE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (22, 'ごまあえ・盛り付け', 5, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 23, ジャム（副菜・洋風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (23, '計量・配膳', 3, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 24, いそあえ（副菜・和風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (24, '野菜の下準備', 5, FALSE, FALSE, 1, TRUE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (24, '茹で作業', 5, TRUE, FALSE, 1, FALSE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (24, 'のり和え・盛り付け', 5, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 25, チーズパン（主食・洋風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (25, 'オーブン加熱', 12, FALSE, TRUE, 1, FALSE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (25, '配膳準備', 3, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 26, ワンタンスープ（汁物・中華風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (26, 'ワンタン包み', 20, FALSE, FALSE, 2, TRUE, TRUE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (26, 'スープ煮込み', 15, TRUE, FALSE, 1, FALSE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (26, '配膳', 5, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 27, りんごゼリー（デザート・洋風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (27, 'ゼリー液作成', 10, TRUE, FALSE, 1, FALSE, TRUE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (27, '冷蔵固め', 120, FALSE, FALSE, 0, TRUE, TRUE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (27, '配膳', 3, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 28, 大豆の和風揚げ（主菜・和風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (28, '大豆の下処理', 10, FALSE, FALSE, 1, TRUE, TRUE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (28, '揚げ調理', 15, TRUE, FALSE, 1, FALSE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (28, '盛り付け', 5, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 29, 野菜スープ（汁物・洋風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (29, '野菜のカット', 10, FALSE, FALSE, 1, TRUE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (29, '煮込み', 20, TRUE, FALSE, 1, FALSE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (29, '配膳', 5, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 30, ソフトフランス（主食・洋風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (30, 'オーブン加熱', 15, FALSE, TRUE, 1, FALSE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (30, '配膳準備', 5, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 31, あじのたれカツ（主菜・和風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (31, '魚の下処理', 15, FALSE, FALSE, 2, TRUE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (31, '揚げ調理', 18, TRUE, FALSE, 1, FALSE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (31, 'たれ調理・盛り付け', 7, TRUE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 32, 黒パン（主食・洋風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (32, 'オーブン加熱', 15, FALSE, TRUE, 1, FALSE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (32, '配膳準備', 5, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 33, 揚げじゃがいものそぼろ煮（主菜・和風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (33, 'じゃがいものカット', 10, FALSE, FALSE, 1, TRUE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (33, '揚げ調理', 15, TRUE, FALSE, 1, FALSE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (33, 'そぼろ煮込み', 20, TRUE, FALSE, 1, FALSE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (33, '盛り付け', 5, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 35, 豚肉のみそ炒め（主菜・和風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (35, '材料のカット', 10, FALSE, FALSE, 1, TRUE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (35, '炒め調理', 15, TRUE, FALSE, 1, FALSE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (35, '盛り付け', 5, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 36, コールスローサラダ（副菜・洋風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (36, 'キャベツの千切り', 10, FALSE, FALSE, 1, TRUE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (36, 'ドレッシング和え', 5, FALSE, FALSE, 1, TRUE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (36, '盛り付け', 3, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 37, キャベツのサラダ（副菜・洋風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (37, 'キャベツのカット', 8, FALSE, FALSE, 1, TRUE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (37, 'ドレッシング和え', 5, FALSE, FALSE, 1, TRUE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (37, '盛り付け', 3, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 38, わかめサラダ（副菜・洋風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (38, 'わかめの戻し', 10, FALSE, FALSE, 1, TRUE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (38, '野菜のカット', 5, FALSE, FALSE, 1, TRUE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (38, 'ドレッシング和え・盛り付け', 5, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 39, 味付けおかか（副菜・和風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (39, '調味・盛り付け', 5, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 40, とり肉の塩こうじ焼き（主菜・和風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (40, '肉の下処理・塩こうじ漬け', 10, FALSE, FALSE, 1, TRUE, TRUE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (40, 'オーブン焼き', 20, FALSE, TRUE, 1, FALSE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (40, '盛り付け', 5, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 41, 肉団子（主菜・洋風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (41, '肉団子成形', 20, FALSE, FALSE, 2, TRUE, TRUE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (41, '煮込み調理', 25, TRUE, FALSE, 1, FALSE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (41, '盛り付け', 5, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 42, ハンバーグ（主菜・洋風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (42, 'ハンバーグ成形', 20, FALSE, FALSE, 2, TRUE, TRUE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (42, '焼き調理', 20, TRUE, FALSE, 1, FALSE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (42, 'ソース作成・盛り付け', 10, TRUE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 43, マーボー生揚げ丼（主食・中華風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (43, '材料のカット', 10, FALSE, FALSE, 1, TRUE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (43, 'ご飯の炊飯', 50, TRUE, FALSE, 1, TRUE, TRUE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (43, 'マーボー調理', 20, TRUE, FALSE, 1, FALSE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (43, '盛り付け', 5, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 44, 野菜サラダ（副菜・洋風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (44, '野菜のカット・洗浄', 10, FALSE, FALSE, 1, TRUE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (44, 'ドレッシング和え', 5, FALSE, FALSE, 1, TRUE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (44, '盛り付け', 3, FALSE, FALSE, 1, TRUE, FALSE);

-- recipe_id: 45, ビビンバ（主食・韓国風）
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (45, '具材のカット', 15, FALSE, FALSE, 2, TRUE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (45, 'ご飯の炊飯', 50, TRUE, FALSE, 1, TRUE, TRUE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (45, 'ナムル調理', 20, TRUE, FALSE, 1, FALSE, FALSE);
INSERT INTO recipe_workload (recipe_id, step_name, cooking_time_min, use_heat, use_oven, required_staff_count, is_parallel_ok, requires_prep_day_before) VALUES (45, '盛り付け', 10, FALSE, FALSE, 2, TRUE, FALSE);

COMMIT;
