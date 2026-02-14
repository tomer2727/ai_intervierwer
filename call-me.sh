#!/bin/bash

# AI Interviewer - Trigger Outbound Call
# This script initiates a call from the AI to your phone number

NGROK_URL="https://axiomatically-overcensorious-zachary.ngrok-free.dev"
PHONE_NUMBER="+972525320099"

echo "🤖 Initiating AI Interviewer call to ${PHONE_NUMBER}..."

curl -X POST ${NGROK_URL}/make-call \
  -H "Content-Type: application/json" \
  -d "{\"to\": \"${PHONE_NUMBER}\"}"

echo ""
echo "✅ Call request sent! Your phone should ring shortly."
