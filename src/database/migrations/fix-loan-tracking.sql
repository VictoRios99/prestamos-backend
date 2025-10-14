-- Primero, eliminar la tabla mal creada si existe
DROP TABLE IF EXISTS monthly_payments CASCADE;

-- Agregar campos nuevos a la tabla loans
ALTER TABLE loans 
ADD COLUMN IF NOT EXISTS current_balance DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS total_interest_paid DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_capital_paid DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_interest_rate DECIMAL(5,2) DEFAULT 5,
ADD COLUMN IF NOT EXISTS months_paid INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_payment_date DATE;

-- Actualizar loans existentes
UPDATE loans SET current_balance = amount WHERE current_balance IS NULL;

-- Crear tabla de pagos mensuales con la estructura correcta
CREATE TABLE monthly_payments (
    id SERIAL PRIMARY KEY,
    loan_id INTEGER REFERENCES loans(id) ON DELETE CASCADE,
    due_date DATE NOT NULL,
    expected_amount DECIMAL(12,2) NOT NULL,
    paid_amount DECIMAL(12,2) DEFAULT 0,
    interest_paid DECIMAL(12,2) DEFAULT 0,
    capital_paid DECIMAL(12,2) DEFAULT 0,
    is_paid BOOLEAN DEFAULT false,
    payment_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices
CREATE INDEX idx_monthly_payments_loan_id ON monthly_payments(loan_id);
CREATE INDEX idx_monthly_payments_due_date ON monthly_payments(due_date);

-- Agregar columnas adicionales a payments si no existen
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS interest_paid DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS capital_paid DECIMAL(12,2) DEFAULT 0;
