#!/bin/bash
# Group batch OTP/SPO invoice — all 6 scenario tests
# Run on portal server: bash /tmp/test-group-invoice.sh

BASE="http://localhost:3000"
BATCH_ID="batch_3ff692a6-f96"
COOKIE_JAR="/tmp/stibe-test-run.txt"

# Grade 10 CBSE 1:30 fees (offer active):
# regularFee=3500000, OTP=2625000, SPO Q1-Q3=840000, Q4=280000
OTP=2625000
Q123=840000
Q4=280000
ADV_OTP=1000000   # ₹10,000 partial OTP advance
ADV_SPO=500000    # ₹5,000 partial SPO Q1 advance

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'
PASS=0
FAIL=0

# ── Login ──────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════"
echo "  GROUP BATCH OTP/SPO INVOICE — SCENARIO TESTS"
echo "══════════════════════════════════════════════════════"
LOGIN=$(curl -s -c "$COOKIE_JAR" -X POST "$BASE/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@stibeedu.in","password":"stibe@2026"}')
echo "Login: $(echo $LOGIN | grep -o '"role":"[^"]*"')"

# ── Cleanup prior test data ────────────────────────────────────────
echo "Cleaning up prior test data..."
sudo -u postgres psql -d stibe_portal -c "
  DELETE FROM batch_students WHERE batch_id = '$BATCH_ID' AND student_email LIKE 'test.%@stibetest.dev';
  DELETE FROM payment_receipts WHERE student_email LIKE 'test.%@stibetest.dev';
  DELETE FROM invoices WHERE student_email LIKE 'test.%@stibetest.dev';
  DELETE FROM user_profiles WHERE email LIKE 'test.%@stibetest.dev';
  DELETE FROM portal_users WHERE email LIKE 'test.%@stibetest.dev';
" 2>/dev/null | grep -v "could not change" | grep -E "DELETE|ERROR"

check_invoice() {
  local email="$1" status="$2" amount="$3" installment="$4" label="$5"
  local query
  if [ -z "$installment" ]; then
    query="SELECT COUNT(*) FROM invoices WHERE student_email='$email' AND status='$status' AND ABS(amount_paise - $amount) < 100;"
  else
    query="SELECT COUNT(*) FROM invoices WHERE student_email='$email' AND status='$status' AND ABS(amount_paise - $amount) < 100 AND installment_number=$installment;"
  fi
  local cnt=$(sudo -u postgres psql -d stibe_portal -tAc "$query" 2>/dev/null)
  cnt=$(echo $cnt | tr -d ' ')
  if [ "$cnt" = "1" ]; then
    echo -e "   ${GREEN}✓${NC} $label"
    PASS=$((PASS+1))
  else
    echo -e "   ${RED}✗ MISSING: $label (status=$status amount=$amount inst=$installment, found=$cnt)${NC}"
    FAIL=$((FAIL+1))
  fi
}

check_gate() {
  local email="$1" batch="$2" expect_set="$3"
  local val=$(sudo -u postgres psql -d stibe_portal -tAc "SELECT quarterly_due_date FROM batch_students WHERE batch_id='$batch' AND student_email='$email';" 2>/dev/null | tr -d ' ')
  if [ "$expect_set" = "yes" ] && [ -n "$val" ] && [ "$val" != "" ]; then
    echo -e "   ${GREEN}✓${NC} quarterly_due_date set ($val)"
    PASS=$((PASS+1))
  elif [ "$expect_set" = "no" ] && [ -z "$val" ]; then
    echo -e "   ${GREEN}✓${NC} quarterly_due_date not set (full payment, no gate)"
    PASS=$((PASS+1))
  elif [ "$expect_set" = "no" ] && [ -n "$val" ]; then
    echo -e "   ${RED}✗ quarterly_due_date unexpectedly set: $val${NC}"
    FAIL=$((FAIL+1))
  else
    echo -e "   ${RED}✗ quarterly_due_date expected but missing (val='$val')${NC}"
    FAIL=$((FAIL+1))
  fi
}

enroll() {
  local label="$1"
  local payload="$2"
  local email="$3"
  echo ""
  echo "── $label ──────────────────────────"
  local resp=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE/api/v1/enrollment/manual" \
    -H 'Content-Type: application/json' \
    -d "$payload")
  local ok=$(echo "$resp" | grep -o '"success":true')
  local inv=$(echo "$resp" | grep -o '"invoice_number":"[^"]*"' | head -1)
  if [ -n "$ok" ]; then
    echo "   ✓ Enrolled  $inv"
  else
    local err=$(echo "$resp" | grep -o '"error":"[^"]*"')
    echo -e "   ${RED}✗ ENROLL FAILED: $err${NC}"
    FAIL=$((FAIL+1))
  fi
}

# ═════════════════════════════════════════════════════════════════
# SCENARIO 1: OTP + no payment
# ═════════════════════════════════════════════════════════════════
EMAIL="test.otp.none@stibetest.dev"
enroll "1. OTP + no payment" \
  "{\"student_name\":\"Test OTP None\",\"student_email\":\"$EMAIL\",\"student_grade\":\"10\",\"student_board\":\"CBSE\",\"batch_id\":\"$BATCH_ID\",\"payment_type\":\"otp\",\"payment_mode\":\"none\",\"payment_method\":\"cash\",\"amount_paise\":0,\"fee_otp_paise\":$OTP,\"fee_spo_q123_paise\":$Q123,\"fee_spo_q4_paise\":$Q4}" \
  "$EMAIL"
check_invoice "$EMAIL" "pending" "$OTP" "" "pending OTP invoice ₹26,250"
check_gate    "$EMAIL" "$BATCH_ID" "yes"

# ═════════════════════════════════════════════════════════════════
# SCENARIO 2: OTP + advance ₹10,000
# ═════════════════════════════════════════════════════════════════
EMAIL="test.otp.advance@stibetest.dev"
BALANCE=$((OTP - ADV_OTP))
enroll "2. OTP + advance ₹10,000" \
  "{\"student_name\":\"Test OTP Advance\",\"student_email\":\"$EMAIL\",\"student_grade\":\"10\",\"student_board\":\"CBSE\",\"batch_id\":\"$BATCH_ID\",\"payment_type\":\"otp\",\"payment_mode\":\"advance\",\"payment_method\":\"cash\",\"amount_paise\":$ADV_OTP,\"fee_otp_paise\":$OTP,\"fee_spo_q123_paise\":$Q123,\"fee_spo_q4_paise\":$Q4}" \
  "$EMAIL"
check_invoice "$EMAIL" "paid"    "$ADV_OTP" "" "paid advance receipt ₹10,000"
check_invoice "$EMAIL" "pending" "$BALANCE" "" "pending balance ₹16,250"
check_gate    "$EMAIL" "$BATCH_ID" "yes"

# ═════════════════════════════════════════════════════════════════
# SCENARIO 3: OTP + full ₹26,250
# ═════════════════════════════════════════════════════════════════
EMAIL="test.otp.full@stibetest.dev"
enroll "3. OTP + full ₹26,250" \
  "{\"student_name\":\"Test OTP Full\",\"student_email\":\"$EMAIL\",\"student_grade\":\"10\",\"student_board\":\"CBSE\",\"batch_id\":\"$BATCH_ID\",\"payment_type\":\"otp\",\"payment_mode\":\"full\",\"payment_method\":\"cash\",\"amount_paise\":$OTP,\"fee_otp_paise\":$OTP,\"fee_spo_q123_paise\":$Q123,\"fee_spo_q4_paise\":$Q4}" \
  "$EMAIL"
check_invoice "$EMAIL" "paid"    "$OTP" "" "paid full OTP ₹26,250"
check_gate    "$EMAIL" "$BATCH_ID" "no"

# ═════════════════════════════════════════════════════════════════
# SCENARIO 4: SPO + no payment
# ═════════════════════════════════════════════════════════════════
EMAIL="test.spo.none@stibetest.dev"
enroll "4. SPO + no payment" \
  "{\"student_name\":\"Test SPO None\",\"student_email\":\"$EMAIL\",\"student_grade\":\"10\",\"student_board\":\"CBSE\",\"batch_id\":\"$BATCH_ID\",\"payment_type\":\"spo\",\"payment_mode\":\"none\",\"payment_method\":\"cash\",\"amount_paise\":0,\"fee_otp_paise\":$OTP,\"fee_spo_q123_paise\":$Q123,\"fee_spo_q4_paise\":$Q4}" \
  "$EMAIL"
check_invoice "$EMAIL" "pending"   "$Q123" "1" "Q1 pending ₹8,400"
check_invoice "$EMAIL" "scheduled" "$Q123" "2" "Q2 scheduled ₹8,400"
check_invoice "$EMAIL" "scheduled" "$Q123" "3" "Q3 scheduled ₹8,400"
check_invoice "$EMAIL" "scheduled" "$Q4"   "4" "Q4 scheduled ₹2,800"
check_gate    "$EMAIL" "$BATCH_ID" "yes"

# ═════════════════════════════════════════════════════════════════
# SCENARIO 5: SPO + partial advance ₹5,000 (< Q1 ₹8,400)
# ═════════════════════════════════════════════════════════════════
EMAIL="test.spo.advance@stibetest.dev"
Q1_BALANCE=$((Q123 - ADV_SPO))
enroll "5. SPO + partial advance ₹5,000" \
  "{\"student_name\":\"Test SPO Advance\",\"student_email\":\"$EMAIL\",\"student_grade\":\"10\",\"student_board\":\"CBSE\",\"batch_id\":\"$BATCH_ID\",\"payment_type\":\"spo\",\"payment_mode\":\"advance\",\"payment_method\":\"cash\",\"amount_paise\":$ADV_SPO,\"fee_otp_paise\":$OTP,\"fee_spo_q123_paise\":$Q123,\"fee_spo_q4_paise\":$Q4}" \
  "$EMAIL"
check_invoice "$EMAIL" "paid"      "$ADV_SPO"   "1" "Q1 partial paid ₹5,000"
check_invoice "$EMAIL" "pending"   "$Q1_BALANCE" "1" "Q1 balance pending ₹3,400"
check_invoice "$EMAIL" "scheduled" "$Q123"      "2" "Q2 scheduled ₹8,400"
check_invoice "$EMAIL" "scheduled" "$Q123"      "3" "Q3 scheduled ₹8,400"
check_invoice "$EMAIL" "scheduled" "$Q4"        "4" "Q4 scheduled ₹2,800"
check_gate    "$EMAIL" "$BATCH_ID" "yes"

# ═════════════════════════════════════════════════════════════════
# SCENARIO 6: SPO + full Q1 ₹8,400
# ═════════════════════════════════════════════════════════════════
EMAIL="test.spo.full@stibetest.dev"
enroll "6. SPO + full Q1 ₹8,400" \
  "{\"student_name\":\"Test SPO Full Q1\",\"student_email\":\"$EMAIL\",\"student_grade\":\"10\",\"student_board\":\"CBSE\",\"batch_id\":\"$BATCH_ID\",\"payment_type\":\"spo\",\"payment_mode\":\"full\",\"payment_method\":\"cash\",\"amount_paise\":$Q123,\"fee_otp_paise\":$OTP,\"fee_spo_q123_paise\":$Q123,\"fee_spo_q4_paise\":$Q4}" \
  "$EMAIL"
check_invoice "$EMAIL" "paid"      "$Q123" "1" "Q1 paid ₹8,400"
check_invoice "$EMAIL" "scheduled" "$Q123" "2" "Q2 scheduled ₹8,400"
check_invoice "$EMAIL" "scheduled" "$Q123" "3" "Q3 scheduled ₹8,400"
check_invoice "$EMAIL" "scheduled" "$Q4"   "4" "Q4 scheduled ₹2,800"
check_gate    "$EMAIL" "$BATCH_ID" "yes"  # SPO full Q1 → gate advances to Q2 due date

# ═════════════════════════════════════════════════════════════════
echo ""
echo "══════════ RESULTS ══════════"
echo -e "  ${GREEN}PASS: $PASS${NC}  |  ${RED}FAIL: $FAIL${NC}"
if [ "$FAIL" = "0" ]; then
  echo -e "  ${GREEN}All scenarios passed!${NC}"
else
  echo -e "  ${RED}$FAIL check(s) failed.${NC}"
fi
echo ""
