FROM python:3.9-alpine

RUN apk update && \
    apk add --no-cache bash curl wget netcat-openbsd && \
    wget https://dl.min.io/client/mc/release/linux-amd64/mc -O /usr/bin/mc && \
    chmod +x /usr/bin/mc

