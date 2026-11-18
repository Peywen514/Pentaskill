CREATE TABLE IF NOT EXISTS payment_orders (
  merchant_trade_no TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  course_id TEXT NOT NULL REFERENCES courses(id),
  course_title TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(amount > 0),
  status TEXT NOT NULL CHECK(status IN ('pending','paid')),
  created_at INTEGER NOT NULL,
  paid_at INTEGER,
  ecpay_trade_no TEXT UNIQUE
);
CREATE INDEX IF NOT EXISTS payment_orders_user ON payment_orders(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS payment_entitlements (
  user_id TEXT NOT NULL REFERENCES users(id),
  course_id TEXT NOT NULL REFERENCES courses(id),
  merchant_trade_no TEXT NOT NULL UNIQUE REFERENCES payment_orders(merchant_trade_no),
  granted_at INTEGER NOT NULL,
  revoked_at INTEGER,
  PRIMARY KEY(user_id,course_id)
);
