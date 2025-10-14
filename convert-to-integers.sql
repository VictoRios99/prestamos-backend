-- Script para convertir todos los campos decimales a enteros
-- Redondea hacia arriba cualquier valor con decimales

BEGIN;

-- Actualizar tabla loans
ALTER TABLE loans
  ALTER COLUMN amount TYPE INTEGER USING CEIL(amount::numeric),
  ALTER COLUMN current_balance TYPE INTEGER USING CEIL(current_balance::numeric),
  ALTER COLUMN total_interest_paid TYPE INTEGER USING CEIL(total_interest_paid::numeric),
  ALTER COLUMN total_capital_paid TYPE INTEGER USING CEIL(total_capital_paid::numeric);

-- Actualizar tabla payments
-- Primero agregar la columna late_interest si no existe
ALTER TABLE payments ADD COLUMN IF NOT EXISTS late_interest INTEGER DEFAULT 0;

-- Luego actualizar todas las columnas
ALTER TABLE payments
  ALTER COLUMN amount TYPE INTEGER USING CEIL(amount::numeric),
  ALTER COLUMN interest_paid TYPE INTEGER USING CEIL(interest_paid::numeric),
  ALTER COLUMN capital_paid TYPE INTEGER USING CEIL(capital_paid::numeric),
  ALTER COLUMN late_interest TYPE INTEGER USING COALESCE(CEIL(late_interest::numeric), 0);

-- Actualizar tabla monthly_payments
ALTER TABLE monthly_payments
  ALTER COLUMN expected_amount TYPE INTEGER USING CEIL(expected_amount::numeric),
  ALTER COLUMN paid_amount TYPE INTEGER USING CEIL(paid_amount::numeric),
  ALTER COLUMN interest_paid TYPE INTEGER USING CEIL(interest_paid::numeric),
  ALTER COLUMN capital_paid TYPE INTEGER USING CEIL(capital_paid::numeric);

-- Actualizar tabla cash_movements
ALTER TABLE cash_movements
  ALTER COLUMN amount TYPE INTEGER USING CEIL(amount::numeric),
  ALTER COLUMN "balanceAfter" TYPE INTEGER USING CEIL("balanceAfter"::numeric);

COMMIT;
