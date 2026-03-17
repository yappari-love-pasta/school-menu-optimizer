-- ==================================================
-- Fixstars Amplify計算履歴テーブル作成SQL
-- ==================================================

-- amplify_calculation_history（Fixstars Amplify計算履歴）
CREATE TABLE IF NOT EXISTS amplify_calculation_history (
    calculation_id SERIAL PRIMARY KEY,
    school_id UUID REFERENCES schools(school_id),
    request_params JSONB NOT NULL,
    response_data JSONB NOT NULL,
    solver_time_sec DECIMAL(10,5),
    total_time_sec DECIMAL(10,5),
    num_variables INTEGER,
    num_constraints INTEGER,
    objective_value DECIMAL(15,5),
    solution_status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP DEFAULT NULL
);

-- コメント追加
COMMENT ON TABLE amplify_calculation_history IS 'Fixstars Amplify計算履歴（リクエスト・レスポンス完全保存）';
COMMENT ON COLUMN amplify_calculation_history.calculation_id IS '計算ID（自動採番）';
COMMENT ON COLUMN amplify_calculation_history.school_id IS '小学校ID';
COMMENT ON COLUMN amplify_calculation_history.request_params IS 'リクエストパラメータ（M, cost, weights等、JSON形式）';
COMMENT ON COLUMN amplify_calculation_history.response_data IS 'レスポンスデータ（meta, plan, checks等、JSON形式）';
COMMENT ON COLUMN amplify_calculation_history.solver_time_sec IS 'ソルバー実行時間（秒）';
COMMENT ON COLUMN amplify_calculation_history.total_time_sec IS '総処理時間（秒）';
COMMENT ON COLUMN amplify_calculation_history.num_variables IS 'QUBO変数の数';
COMMENT ON COLUMN amplify_calculation_history.num_constraints IS '制約条件の数';
COMMENT ON COLUMN amplify_calculation_history.objective_value IS '目的関数値';
COMMENT ON COLUMN amplify_calculation_history.solution_status IS '解のステータス（optimal, feasible, infeasible等）';

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_amplify_calculation_history_school ON amplify_calculation_history(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_amplify_calculation_history_request ON amplify_calculation_history USING GIN(request_params);
CREATE INDEX IF NOT EXISTS idx_amplify_calculation_history_response ON amplify_calculation_history USING GIN(response_data);

-- ==================================================
-- 完了
-- ==================================================
