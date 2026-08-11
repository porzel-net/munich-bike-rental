FROM alpine:3.22

RUN apk add --no-cache restic sqlite tzdata coreutils

COPY backup.sh /usr/local/bin/backup.sh
COPY entrypoint.sh /usr/local/bin/backup-entrypoint.sh

RUN chmod 0755 /usr/local/bin/backup.sh /usr/local/bin/backup-entrypoint.sh \
  && mkdir -p /backup /source

ENTRYPOINT ["/usr/local/bin/backup-entrypoint.sh"]
