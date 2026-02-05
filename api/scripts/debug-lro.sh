#!/bin/bash
PROJECT="gen-lang-client-0645888032"
LOCATION="us-central1"
TOKEN=$(gcloud auth print-access-token)
MODEL="veo-3.0-generate-preview"

echo "Checking: locations/.../operations (Generic)"
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://${LOCATION}-aiplatform.googleapis.com/v1beta1/projects/${PROJECT}/locations/${LOCATION}/operations" | head -n 20

echo -e "\n\nChecking: locations/.../publishers/google/operations (Publisher Generic)"
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://${LOCATION}-aiplatform.googleapis.com/v1beta1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/operations" | head -n 20

echo -e "\n\nChecking: .../models/${MODEL}/operations (Model Scoped)"
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://${LOCATION}-aiplatform.googleapis.com/v1beta1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${MODEL}/operations" | head -n 20
