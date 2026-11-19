#!/usr/bin/env bash
# Creates the first administrator in the LOCAL Supabase instance (supabase start).
# Usage: scripts/create-local-admin.sh <email> "<Full Name>"
# Prints a generated temporary password; change it after signing in at /set-password.
set -euo pipefail
cd "$(dirname "$0")/.."

EMAIL="${1:?Usage: $0 <email> \"<Full Name>\"}"
NAME="${2:?Usage: $0 <email> \"<Full Name>\"}"
SR=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2)
URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | cut -d= -f2)
case "$URL" in http://127.0.0.1:*|http://localhost:*) ;; *) echo "Refusing: .env.local does not point at local Supabase ($URL)"; exit 1;; esac

PW="Jax-$(openssl rand -hex 6)"
BODY=$(EMAIL="$EMAIL" NAME="$NAME" PW="$PW" python3 -c 'import json,os;print(json.dumps({"email":os.environ["EMAIL"],"password":os.environ["PW"],"email_confirm":True,"user_metadata":{"full_name":os.environ["NAME"]}}))')

RESP=$(curl -s -X POST "$URL/auth/v1/admin/users" -H "apikey: $SR" -H "Authorization: Bearer $SR" -H "Content-Type: application/json" -d "$BODY")
ID=$(printf '%s' "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("id",""))')
[ -n "$ID" ] || { echo "User creation failed: $RESP"; exit 1; }

docker exec supabase_db_tradeshow-evaluator psql -U postgres -tAc "update public.profiles set role='admin' where id='$ID' returning full_name, role;"
echo "Created administrator. Temporary password: $PW"
