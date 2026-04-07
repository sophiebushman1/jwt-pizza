#!/bin/bash
# JWT Pizza - Generate Pizza Traffic
# Simulates realistic traffic against the pizza service for chaos testing
# Usage: ./generatePizzaTraffic.sh [host]
# Example: ./generatePizzaTraffic.sh https://pizza-service.sophiebyu.click

HOST=${1:-"https://pizza-service.sophiebyu.click"}

if [ -z "$HOST" ]; then
  echo "Usage: $0 <host>"
  echo "Example: $0 https://pizza-service.sophiebyu.click"
  exit 1
fi

echo "🍕 Generating pizza traffic against: $HOST"
echo "Press Ctrl+C to stop all background processes"
echo ""

# Cleanup on exit
cleanup() {
  echo ""
  echo "Stopping traffic simulation..."
  kill 0
  exit 0
}
trap cleanup SIGINT SIGTERM

# ── Get menu every 3 seconds ──────────────────────────────────────────────────
menu_loop() {
  while true; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$HOST/api/order/menu")
    echo "Requesting menu... $STATUS"
    sleep 3
  done
}

# ── Invalid login every 25 seconds ───────────────────────────────────────────
bad_login_loop() {
  while true; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$HOST/api/auth" \
      -d '{"email":"unknown@jwt.com", "password":"bad"}' \
      -H 'Content-Type: application/json')
    echo "Logging in with invalid credentials... $STATUS"
    sleep 25
  done
}

# ── Franchisee login/logout every 2 minutes ──────────────────────────────────
franchisee_loop() {
  while true; do
    RESPONSE=$(curl -s -X PUT "$HOST/api/auth" \
      -d '{"email":"f@jwt.com", "password":"franchisee"}' \
      -H 'Content-Type: application/json')
    TOKEN=$(echo "$RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    echo "Login franchisee... $([ -n "$TOKEN" ] && echo true || echo false)"
    sleep 110
    if [ -n "$TOKEN" ]; then
      curl -s -X DELETE "$HOST/api/auth" -H "Authorization: Bearer $TOKEN" > /dev/null
    fi
    sleep 10
  done
}

# ── Diner: login, buy pizza, logout every 50 seconds ─────────────────────────
diner_loop() {
  while true; do
    RESPONSE=$(curl -s -X PUT "$HOST/api/auth" \
      -d '{"email":"d@jwt.com", "password":"diner"}' \
      -H 'Content-Type: application/json')
    TOKEN=$(echo "$RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    echo "Login diner... $([ -n "$TOKEN" ] && echo true || echo false)"

    if [ -n "$TOKEN" ]; then
      STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$HOST/api/order" \
        -H 'Content-Type: application/json' \
        -H "Authorization: Bearer $TOKEN" \
        -d '{"franchiseId": 1, "storeId":1, "items":[{ "menuId": 1, "description": "Veggie", "price": 0.05 }]}')
      echo "Bought a pizza... $STATUS"
      sleep 20
      curl -s -X DELETE "$HOST/api/auth" -H "Authorization: Bearer $TOKEN" > /dev/null
    fi
    sleep 30
  done
}

# ── Hungry diner: orders too many pizzas (triggers failure) every 5 minutes ──
hungry_diner_loop() {
  while true; do
    RESPONSE=$(curl -s -X PUT "$HOST/api/auth" \
      -d '{"email":"d@jwt.com", "password":"diner"}' \
      -H 'Content-Type: application/json')
    TOKEN=$(echo "$RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    echo "Login hungry diner... $([ -n "$TOKEN" ] && echo true || echo false)"

    if [ -n "$TOKEN" ]; then
      ITEMS='{ "menuId": 1, "description": "Veggie", "price": 0.05 }'
      for i in $(seq 1 20); do
        ITEMS="$ITEMS, { \"menuId\": 1, \"description\": \"Veggie\", \"price\": 0.05 }"
      done
      STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$HOST/api/order" \
        -H 'Content-Type: application/json' \
        -H "Authorization: Bearer $TOKEN" \
        -d "{\"franchiseId\": 1, \"storeId\":1, \"items\":[$ITEMS]}")
      echo "Bought too many pizzas... $STATUS"
      sleep 5
      curl -s -X DELETE "$HOST/api/auth" -H "Authorization: Bearer $TOKEN" > /dev/null
    fi
    sleep 295
  done
}

# Start all loops as background processes
menu_loop &
bad_login_loop &
franchisee_loop &
diner_loop &
hungry_diner_loop &

# Wait for all background processes
wait
