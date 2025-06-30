ARG BASE_IMAGE=mcr.microsoft.com/vscode/devcontainers/python
ARG DEBIAN_VERSION=bookworm
ARG PYTHON_VERSION=3.12
ARG TENV_VERSION=latest
ARG TFLINT_VERSION=v0.57.0
ARG TRIVY_VERSION=latest


FROM tofuutils/tenv:$TENV_VERSION AS tenv

FROM ghcr.io/terraform-linters/tflint:$TFLINT_VERSION AS tflint

FROM ghcr.io/aquasecurity/trivy:$TRIVY_VERSION AS trivy


FROM python:$PYTHON_VERSION-slim-$DEBIAN_VERSION AS builder

ARG GCLOUD_SDK_VERSION=502.0.0

SHELL [ "/bin/bash", "-o", "pipefail", "-c" ]

# hadolint ignore=DL3008
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    curl git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN if [ "$(uname -m)" = 'aarch64' ]; then _ARCH=arm; else _ARCH=x86_64; fi \
    && curl -fsS "https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-$GCLOUD_SDK_VERSION-linux-$_ARCH.tar.gz" \
    | tar zx -C /opt \
    && /opt/google-cloud-sdk/install.sh \
    --quiet \
    --usage-reporting=false \
    --additional-components alpha beta


FROM $BASE_IMAGE:$PYTHON_VERSION-$DEBIAN_VERSION

COPY --from=builder --chown=vscode: /opt/google-cloud-sdk /opt/google-cloud-sdk
COPY --from=tflint --chown=vscode: /usr/local/bin/tflint /usr/local/bin/tflint
COPY --from=trivy --chown=vscode: /usr/local/bin/trivy /usr/local/bin/trivy
COPY --from=tenv /usr/local/bin/tenv /usr/local/bin/tenv
COPY --from=tenv /usr/local/bin/terraform /usr/local/bin/terraform

LABEL maintainer="a5chin <a5chin.origin+contact@gmain.com>"

ENV PATH=$PATH:/opt/google-cloud-sdk/bin
