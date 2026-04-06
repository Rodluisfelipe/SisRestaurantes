#!/bin/bash
ENV_FILE="/opt/sisrestaurantes/Backend/.env"

# Update EMAIL_FROM
sed -i 's|^EMAIL_FROM=.*|EMAIL_FROM=noreply@menuby.tech|' "$ENV_FILE"

# Add new vars if they don't exist
grep -q '^EMAIL_FROM_NAME=' "$ENV_FILE" || echo 'EMAIL_FROM_NAME=MenuBy' >> "$ENV_FILE"
grep -q '^RESEND_API_KEY=' "$ENV_FILE" || echo 'RESEND_API_KEY=re_WDeStvVe_KpKcoeeFf2X119Fi6znD5xmo' >> "$ENV_FILE"

# Verify
echo "--- Email env vars ---"
grep -E 'EMAIL_FROM|RESEND_API_KEY|BREVO_API_KEY|SENDGRID_API_KEY' "$ENV_FILE"
