FROM alpine:3.22@sha256:5291449c3df73caf6ed85e649dec1b9e818b39a5d8c871e97afc13e9cd5e8fa8

RUN apk add --no-cache restic sqlite tzdata coreutils

COPY backup.sh /usr/local/bin/backup.sh
COPY entrypoint.sh /usr/local/bin/backup-entrypoint.sh

RUN chmod 0755 /usr/local/bin/backup.sh /usr/local/bin/backup-entrypoint.sh \
  && mkdir -p /backup /source

ENTRYPOINT ["/usr/local/bin/backup-entrypoint.sh"]
